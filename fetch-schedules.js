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

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
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
        .data-section {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        pre {
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 14px;
            max-height: 600px;
            overflow-y: auto;
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
            Données récupérées depuis Firebase (Calendar/${currentYear}/${currentWeek})<br>
            Dernière mise à jour: ${now.toLocaleString('fr-FR')}
        </div>

        <div class="data-section">
            <h2>📊 Données de la semaine ${currentWeek}</h2>
            <p>Structure des données récupérées:</p>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        </div>

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
