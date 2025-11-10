#!/usr/bin/env python3
"""
Script pour récupérer les horaires des ferries Tahiti-Moorea depuis Firebase
"""

import json
import sys
from datetime import datetime
import requests

# Configuration Firebase de terevau.pf
FIREBASE_CONFIG = {
    "api_key": "AIzaSyB0wkLX44cZtk4lIDSVOQiOFwvts-Wqm3I",
    "auth_domain": "terevau-9651d.firebaseapp.com",
    "database_url": "https://terevau-9651d.firebaseio.com",
    "project_id": "terevau-9651d",
}


def authenticate_anonymous():
    """Authentification anonyme avec Firebase"""
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={FIREBASE_CONFIG['api_key']}"

    payload = {
        "returnSecureToken": True
    }

    try:
        print("🔐 Tentative de connexion à Firebase...")
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()

        data = response.json()
        id_token = data.get('idToken')

        print(f"✅ Authentification anonyme réussie: {data.get('localId', 'N/A')}")
        return id_token
    except requests.exceptions.RequestException as e:
        print(f"⚠️  Authentification anonyme échouée: {e}")
        return None


def fetch_firebase_data(id_token=None):
    """Récupération des données depuis Firebase Realtime Database"""
    print("📊 Récupération des données depuis Firebase Realtime Database...")

    # URL de la base de données avec .json pour l'API REST
    url = f"{FIREBASE_CONFIG['database_url']}.json"

    # Ajouter le token d'authentification si disponible
    params = {}
    if id_token:
        params['auth'] = id_token

    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()

        data = response.json()

        if data:
            print("✅ Données récupérées avec succès!")
            print(f"📋 Clés disponibles: {list(data.keys())}")

            # Sauvegarder les données brutes
            with open('data.json', 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print("💾 Données sauvegardées dans data.json")

            return data
        else:
            print("❌ Aucune donnée trouvée")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur lors de la récupération des données: {e}")
        return None


def get_week_number(date):
    """Calcule le numéro de la semaine"""
    return date.isocalendar()[1]


def generate_html(data):
    """Génère la page HTML avec les horaires"""
    now = datetime.now()
    current_week = get_week_number(now)

    # Formater la date en français
    date_str = now.strftime("%A %d %B %Y")

    # Traduction des jours en français (approximative)
    date_fr = date_str.replace('Monday', 'Lundi').replace('Tuesday', 'Mardi').replace('Wednesday', 'Mercredi')
    date_fr = date_fr.replace('Thursday', 'Jeudi').replace('Friday', 'Vendredi').replace('Saturday', 'Samedi').replace('Sunday', 'Dimanche')

    # Convertir les données en JSON formaté
    data_json = json.dumps(data, ensure_ascii=False, indent=2)

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
        }}
        .container {{
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}
        h1 {{
            color: #667eea;
            text-align: center;
            margin-bottom: 10px;
        }}
        .subtitle {{
            text-align: center;
            color: #666;
            margin-bottom: 30px;
        }}
        .info {{
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }}
        .data-section {{
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }}
        pre {{
            background: #282c34;
            color: #abb2bf;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            font-size: 14px;
            max-height: 600px;
            overflow-y: auto;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🚢 Horaires Ferries Tahiti-Moorea</h1>
        <div class="subtitle">Semaine {current_week} - {date_fr}</div>

        <div class="info">
            <strong>ℹ️ Informations:</strong><br>
            Données récupérées depuis la base Firebase de terevau.pf<br>
            Dernière mise à jour: {now.strftime("%d/%m/%Y %H:%M:%S")}
        </div>

        <div class="data-section">
            <h2>📊 Données disponibles</h2>
            <p>Structure des données récupérées:</p>
            <pre>{data_json}</pre>
        </div>

        <div class="footer">
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
            <p>Script Python - Projet: Moorea Life Schedule</p>
        </div>
    </div>
</body>
</html>"""

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("✅ Page HTML générée: index.html")


def generate_error_html(error_message):
    """Génère une page HTML d'erreur"""
    now = datetime.now()

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea - Erreur</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }}
        .container {{
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }}
        h1 {{
            color: #f5576c;
            text-align: center;
        }}
        .error {{
            background: #fff5f5;
            border-left: 4px solid #f5576c;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }}
        .footer {{
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>❌ Erreur de récupération des données</h1>

        <div class="error">
            <strong>Message d'erreur:</strong><br>
            {error_message}
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
            <p>Date de la tentative: {now.strftime("%d/%m/%Y %H:%M:%S")}</p>
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
        </div>
    </div>
</body>
</html>"""

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("⚠️  Page HTML d'erreur générée: index.html")


def main():
    """Fonction principale"""
    try:
        # Authentification
        id_token = authenticate_anonymous()

        # Récupération des données
        data = fetch_firebase_data(id_token)

        if data:
            # Génération de la page HTML
            generate_html(data)
            print("✅ Processus terminé avec succès")
            sys.exit(0)
        else:
            generate_error_html("Aucune donnée récupérée depuis Firebase")
            print("⚠️  Processus terminé avec des erreurs")
            sys.exit(1)

    except Exception as e:
        print(f"❌ Erreur générale: {e}")
        generate_error_html(str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
