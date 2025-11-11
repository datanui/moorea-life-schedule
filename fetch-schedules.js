import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, get, goOffline } from 'firebase/database';
import fs from 'fs';

// Configuration Firebase de terevau.pf
const firebaseConfig = {
  apiKey: "AIzaSyB0wkLX44cZtk4lIDSVOQiOFwvts-Wqm3I",
  authDomain: "terevau-9651d.firebaseapp.com",
  databaseURL: "https://terevau-9651d.firebaseio.com",
  projectId: "terevau-9651d",
  storageBucket: "terevau-9651d.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

function getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

async function fetchSchedules() {
  try {
    console.log("🔐 Tentative de connexion à Firebase...");

    // Tentative d'authentification anonyme
    try {
      const userCredential = await signInAnonymously(auth);
      console.log("✅ Authentification anonyme réussie:", userCredential.user.uid);
    } catch (authError) {
      console.log("⚠️  Authentification anonyme échouée, tentative de lecture directe:", authError.message);
    }

    // Calculer la semaine et l'année actuelles
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();

    console.log(`📊 Récupération des données pour la semaine ${currentWeek} de ${currentYear}...`);

    // Construire le chemin Firebase: /Calendar/YEAR/WEEK
    const weekPath = `Calendar/${currentYear}/${currentWeek}`;
    console.log(`🔗 Chemin Firebase: ${weekPath}`);

    const weekRef = ref(database, weekPath);

    try {
      const snapshot = await get(weekRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("✅ Données de la semaine récupérées avec succès!");
        console.log(`📋 Type de données: ${typeof data}`);

        if (typeof data === 'object' && data !== null) {
          console.log("📋 Clés disponibles:", Object.keys(data).slice(0, 10));
        }

        // Sauvegarder les données brutes
        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log("💾 Données sauvegardées dans data.json");

        // Générer la page HTML
        generateHTML(data, currentWeek, currentYear);

        return data;
      } else {
        console.log(`❌ Aucune donnée trouvée pour la semaine ${currentWeek}`);

        // Essayer d'autres chemins si le chemin principal ne fonctionne pas
        console.log("🔍 Tentative de chemins alternatifs...");

        const alternativePaths = [
          `/Calendar/${currentYear}`,
          `/Calendar`,
          '/'
        ];

        for (const altPath of alternativePaths) {
          console.log(`🔍 Test du chemin: ${altPath}`);
          const altRef = ref(database, altPath);
          const altSnapshot = await get(altRef);

          if (altSnapshot.exists()) {
            const altData = altSnapshot.val();
            console.log(`✅ Données trouvées dans: ${altPath}`);

            if (typeof altData === 'object') {
              console.log(`📋 Clés: ${Object.keys(altData).slice(0, 10)}`);
            }

            const filename = `data-${altPath.replace(/\//g, '_')}.json`;
            fs.writeFileSync(filename, JSON.stringify(altData, null, 2));
            console.log(`💾 Sauvegardé dans ${filename}`);
          }
        }

        generateErrorHTML(`Aucune donnée trouvée pour la semaine ${currentWeek} de ${currentYear} au chemin: ${weekPath}`);
      }
    } catch (dbError) {
      console.error("❌ Erreur lors de la récupération des données:", dbError.message);
      generateErrorHTML(dbError.message);
    }

  } catch (error) {
    console.error("❌ Erreur générale:", error);
    generateErrorHTML(error.message);
  } finally {
    // Fermer la connexion Firebase pour permettre au processus de se terminer
    console.log("🔌 Fermeture de la connexion Firebase...");
    goOffline(database);

    // Petit délai pour s'assurer que tout est terminé
    setTimeout(() => {
      console.log("✅ Processus terminé");
      process.exit(0);
    }, 500);
  }
}

function generateHTML(data, currentWeek, currentYear) {
  const now = new Date();

  // Parse les données et crée le tableau
  const scheduleTable = parseScheduleData(data, currentWeek, currentYear);

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea</title>
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
        .info {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
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
        .debug-section {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .debug-section summary {
            cursor: pointer;
            font-weight: 600;
            color: #667eea;
            padding: 10px;
        }
        pre {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 12px;
            max-height: 400px;
            overflow-y: auto;
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
            Données récupérées depuis Firebase (Calendar/${currentYear}/${currentWeek})<br>
            Dernière mise à jour: ${now.toLocaleString('fr-FR')}
        </div>

        ${scheduleTable}

        <details class="debug-section">
            <summary>📊 Voir les données brutes</summary>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </details>

        <div class="footer">
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
            <p>Projet: Moorea Life Schedule</p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync('index.html', html);
  console.log("✅ Page HTML générée: index.html");
}

function parseScheduleData(data, currentWeek, currentYear) {
  if (!data || typeof data !== 'object') {
    return '<div class="info">❌ Aucune donnée disponible</div>';
  }

  // Récupère la date du lundi de la semaine
  const mondayDate = getMondayOfWeek(currentWeek, currentYear);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fonction pour convertir les secondes en format HH:MM
  const secondsToTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Organiser les données par jour
  const scheduleByDay = {};

  // Structure des données: { "MOZ": [...], "PPT": [...] }
  // Chaque tableau contient des objets représentant des jours
  // Chaque objet jour contient des horaires indexés par ID

  // Parcourir toutes les destinations
  for (const destination of ['MOZ', 'PPT']) {
    if (!data[destination] || !Array.isArray(data[destination])) {
      continue;
    }

    // Parcourir les jours
    for (const dayData of data[destination]) {
      if (!dayData || typeof dayData !== 'object') {
        continue;
      }

      // Parcourir les horaires du jour
      for (const [scheduleId, schedule] of Object.entries(dayData)) {
        if (!schedule || typeof schedule !== 'object') {
          continue;
        }

        const day = schedule.day;
        if (day === undefined || day === null) {
          continue;
        }

        // Initialiser le jour si nécessaire
        if (!scheduleByDay[day]) {
          scheduleByDay[day] = {
            pptToMoz: [], // Départs de Papeete vers Moorea
            mozToPpt: []  // Départs de Moorea vers Papeete
          };
        }

        // Déterminer la direction et ajouter l'horaire
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

  // Trier les horaires par heure de départ pour chaque jour
  for (const day in scheduleByDay) {
    scheduleByDay[day].pptToMoz.sort((a, b) => a.timeBegin - b.timeBegin);
    scheduleByDay[day].mozToPpt.sort((a, b) => a.timeBegin - b.timeBegin);
  }

  // Générer les lignes du tableau
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

    // Départs PPT→MOZ
    const pptToMozTimes = scheduleByDay[day].pptToMoz;
    const pptToMozHtml = pptToMozTimes.length > 0
      ? pptToMozTimes.map(s => `<span class="time-badge">${s.time}</span>`).join(' ')
      : '<span style="color: #999;">-</span>';

    // Départs MOZ→PPT
    const mozToPptTimes = scheduleByDay[day].mozToPpt;
    const mozToPptHtml = mozToPptTimes.length > 0
      ? mozToPptTimes.map(s => `<span class="time-badge">${s.time}</span>`).join(' ')
      : '<span style="color: #999;">-</span>';

    // Vérifie si c'est aujourd'hui
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

function getMondayOfWeek(week, year) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7; // 1=Lundi, 7=Dimanche
  const mondayJan4Week = new Date(jan4);
  mondayJan4Week.setDate(jan4.getDate() - (jan4Day - 1));

  const targetMonday = new Date(mondayJan4Week);
  targetMonday.setDate(mondayJan4Week.getDate() + (week - 1) * 7);

  return targetMonday;
}

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

// Lancer la récupération
fetchSchedules();
