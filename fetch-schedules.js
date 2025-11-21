import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, goOffline } from 'firebase/database';
import fs from 'fs';

// Fonction pour obtenir le numéro de la semaine
function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// Fonction pour obtenir le lundi d'une semaine
function getMondayOfWeek(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mondayJan4Week = new Date(jan4);
  mondayJan4Week.setDate(jan4.getDate() - (jan4Day - 1));

  const targetMonday = new Date(mondayJan4Week);
  targetMonday.setDate(mondayJan4Week.getDate() + (week - 1) * 7);

  return targetMonday;
}

// Fonction pour récupérer les horaires d'une compagnie
async function fetchCompanySchedules(company, currentWeek, currentYear) {
  console.log(`\n🚢 Traitement de ${company.name}...`);

  try {
    // Initialiser Firebase pour cette compagnie
    const app = initializeApp(company.firebase, company.id);
    const auth = getAuth(app);
    const database = getDatabase(app);

    // Tentative d'authentification anonyme
    try {
      const userCredential = await signInAnonymously(auth);
      console.log(`✅ Authentification anonyme réussie pour ${company.name}`);
    } catch (authError) {
      console.log(`⚠️  Authentification anonyme échouée pour ${company.name}, tentative de lecture directe`);
    }

    // Construire le chemin Firebase
    const weekPath = `Calendar/${currentYear}/${currentWeek}`;
    console.log(`🔗 Chemin Firebase: ${weekPath}`);

    const weekRef = ref(database, weekPath);
    const snapshot = await get(weekRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log(`✅ Données récupérées pour ${company.name}`);

      // Sauvegarder dans data/{company-id}.json
      const filename = `data/${company.id}.json`;
      fs.writeFileSync(filename, JSON.stringify({
        company: company.name,
        companyId: company.id,
        week: currentWeek,
        year: currentYear,
        data: data,
        lastUpdate: new Date().toISOString()
      }, null, 2));
      console.log(`💾 Données sauvegardées: ${filename}`);

      // Fermer la connexion
      goOffline(database);

      return {
        success: true,
        company: company,
        data: data
      };
    } else {
      console.log(`❌ Aucune donnée trouvée pour ${company.name}`);

      // Fermer la connexion
      goOffline(database);

      return {
        success: false,
        company: company,
        error: `Aucune donnée trouvée pour la semaine ${currentWeek}`
      };
    }
  } catch (error) {
    console.error(`❌ Erreur pour ${company.name}:`, error.message);
    return {
      success: false,
      company: company,
      error: error.message
    };
  }
}

// Fonction pour vérifier si une compagnie est configurée
function isCompanyConfigured(company) {
  const firebase = company.firebase;
  // Vérifier si ce sont des valeurs placeholder
  if (firebase.apiKey.startsWith('YOUR_') ||
      firebase.databaseURL.includes('your-project') ||
      firebase.projectId === 'your-project') {
    return false;
  }
  return true;
}

// Fonction principale
async function fetchAllSchedules() {
  try {
    console.log("📋 Chargement de la configuration des compagnies...");

    // Charger la configuration des compagnies
    const companiesConfig = JSON.parse(fs.readFileSync('companies.json', 'utf8'));
    const allCompanies = companiesConfig.companies;

    // Filtrer uniquement les compagnies configurées
    const companies = allCompanies.filter(isCompanyConfigured);

    console.log(`✅ ${companies.length} compagnie(s) configurée(s) sur ${allCompanies.length} au total`);

    // Calculer la semaine et l'année actuelles
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();

    console.log(`📅 Semaine ${currentWeek} de ${currentYear}`);

    // Créer le répertoire data s'il n'existe pas
    if (!fs.existsSync('data')) {
      fs.mkdirSync('data');
    }

    // Récupérer les horaires pour chaque compagnie
    const results = [];
    for (const company of companies) {
      const result = await fetchCompanySchedules(company, currentWeek, currentYear);
      results.push(result);

      // Petit délai entre chaque requête
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Générer la page HTML
    generateMultiCompanyHTML(results, currentWeek, currentYear);

    console.log("\n✅ Processus terminé avec succès!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Erreur générale:", error);
    generateErrorHTML(error.message);
    process.exit(1);
  }
}

// Fonction pour générer le HTML multi-compagnies
function generateMultiCompanyHTML(results, currentWeek, currentYear) {
  const now = new Date();

  // Générer les sections pour chaque compagnie
  const companySections = results.map(result => {
    if (result.success) {
      const scheduleTable = parseScheduleData(result.data, currentWeek, currentYear);
      return `
        <div class="company-section">
          <h2 style="color: ${result.company.color};">🚢 ${result.company.name}</h2>
          ${scheduleTable}
        </div>
      `;
    } else {
      return `
        <div class="company-section error-section">
          <h2 style="color: #f5576c;">⚠️ ${result.company.name}</h2>
          <div class="error">
            <strong>Erreur:</strong> ${result.error}
          </div>
        </div>
      `;
    }
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea - Toutes Compagnies</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #667eea;
            text-align: center;
            margin-bottom: 10px;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }
        .company-section {
            margin: 40px 0;
            padding: 20px;
            border-radius: 10px;
            background: #f8f9fa;
        }
        .company-section h2 {
            margin-top: 0;
        }
        .error-section {
            background: #fff5f5;
        }
        .info {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .error {
            background: #fff5f5;
            border-left: 4px solid #f5576c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        .schedule-table thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .schedule-table th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 16px;
        }
        .schedule-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
        }
        .schedule-table tbody tr:hover {
            background: #f8f9fa;
        }
        .schedule-table tbody tr:last-child td {
            border-bottom: none;
        }
        .date-cell {
            font-weight: 600;
            color: #667eea;
            white-space: nowrap;
        }
        .times-cell {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.6;
        }
        .time-badge {
            display: inline-block;
            background: #f0f4ff;
            padding: 4px 8px;
            margin: 2px;
            border-radius: 4px;
            border: 1px solid #667eea;
        }
        .today {
            background: #fff9e6 !important;
        }
        .today .date-cell {
            color: #f5576c;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚢 Horaires Ferries Tahiti-Moorea</h1>
        <div class="subtitle">Semaine ${currentWeek} de ${currentYear} - ${now.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</div>

        <div class="info">
            <strong>ℹ️ Informations:</strong><br>
            Cette page affiche les horaires de toutes les compagnies maritimes desservant la liaison Tahiti-Moorea.<br>
            Dernière mise à jour: ${now.toLocaleString('fr-FR')}
        </div>

        ${companySections}

        <div class="footer">
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
            <p>Projet: Moorea Life Schedule</p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log("✅ Page HTML multi-compagnies générée: index.html");
}

// Fonction pour parser les données d'horaires
function parseScheduleData(data, currentWeek, currentYear) {
  if (!data || typeof data !== 'object') {
    return '<div class="info">❌ Aucune donnée disponible</div>';
  }

  const mondayDate = getMondayOfWeek(currentWeek, currentYear);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const secondsToTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const scheduleByDay = {};

  for (const destination of ['MOZ', 'PPT']) {
    if (!data[destination] || !Array.isArray(data[destination])) {
      continue;
    }

    for (const dayData of data[destination]) {
      if (!dayData || typeof dayData !== 'object') {
        continue;
      }

      for (const [scheduleId, schedule] of Object.entries(dayData)) {
        if (!schedule || typeof schedule !== 'object') {
          continue;
        }

        const day = schedule.day;
        if (day === undefined || day === null) {
          continue;
        }

        if (!scheduleByDay[day]) {
          scheduleByDay[day] = {
            pptToMoz: [],
            mozToPpt: []
          };
        }

        const timeStr = secondsToTime(schedule.timeBegin);
        const scheduleInfo = {
          time: timeStr,
          timeBegin: schedule.timeBegin,
          vessel: schedule.vessel || 'N/A',
          status: schedule.status
        };

        if (schedule.origin === 'PPT' && schedule.destination === 'MOZ') {
          scheduleByDay[day].pptToMoz.push(scheduleInfo);
        } else if (schedule.origin === 'MOZ' && schedule.destination === 'PPT') {
          scheduleByDay[day].mozToPpt.push(scheduleInfo);
        }
      }
    }
  }

  for (const day in scheduleByDay) {
    scheduleByDay[day].pptToMoz.sort((a, b) => a.timeBegin - b.timeBegin);
    scheduleByDay[day].mozToPpt.sort((a, b) => a.timeBegin - b.timeBegin);
  }

  const rows = [];
  const daysOfWeek = Object.keys(scheduleByDay).map(Number).sort((a, b) => a - b);

  for (const day of daysOfWeek) {
    const currentDate = new Date(mondayDate);
    currentDate.setDate(mondayDate.getDate() + day);

    const dateStr = currentDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    const pptToMozTimes = scheduleByDay[day].pptToMoz;
    const pptToMozHtml = pptToMozTimes.length > 0
      ? pptToMozTimes.map(s => `<span class="time-badge">${s.time}</span>`).join(' ')
      : '<span style="color: #999;">-</span>';

    const mozToPptTimes = scheduleByDay[day].mozToPpt;
    const mozToPptHtml = mozToPptTimes.length > 0
      ? mozToPptTimes.map(s => `<span class="time-badge">${s.time}</span>`).join(' ')
      : '<span style="color: #999;">-</span>';

    const isToday = currentDate.getTime() === today.getTime();
    const rowClass = isToday ? 'today' : '';

    rows.push(`
      <tr class="${rowClass}">
        <td class="date-cell">${dateStr}</td>
        <td class="times-cell">${pptToMozHtml}</td>
        <td class="times-cell">${mozToPptHtml}</td>
      </tr>
    `);
  }

  if (rows.length === 0) {
    return '<div class="info">❌ Aucun horaire trouvé dans les données</div>';
  }

  return `
    <table class="schedule-table">
      <thead>
        <tr>
          <th>📅 Date</th>
          <th>🚢 Départs Papeete → Moorea</th>
          <th>🚢 Départs Moorea → Papeete</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join('')}
      </tbody>
    </table>
  `;
}

// Fonction pour générer une page d'erreur
function generateErrorHTML(errorMessage) {
  const now = new Date();

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea - Erreur</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #f5576c;
            text-align: center;
        }
        .error {
            background: #fff5f5;
            border-left: 4px solid #f5576c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Erreur de récupération des données</h1>

        <div class="error">
            <strong>Message d'erreur:</strong><br>
            ${errorMessage}
        </div>

        <div class="error">
            <strong>ℹ️ Informations:</strong><br>
            La tentative de récupération des horaires depuis Firebase a échoué.<br>
            Cela peut être dû à:<br>
            <ul>
                <li>Les données ne sont pas accessibles en lecture publique</li>
                <li>L'authentification anonyme n'est pas activée</li>
                <li>Les règles de sécurité Firebase bloquent l'accès</li>
            </ul>
        </div>

        <div class="footer">
            <p>Date de la tentative: ${now.toLocaleString('fr-FR')}</p>
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log("⚠️  Page HTML d'erreur générée: index.html");
}

// Lancer le processus
fetchAllSchedules();
