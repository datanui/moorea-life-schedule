# 🚢 Moorea Life Schedule

Projet pour récupérer et afficher les horaires des ferries Tahiti-Moorea depuis les bases de données Firebase de plusieurs compagnies maritimes.

## 📋 Fonctionnalités

- ✅ Support de plusieurs compagnies maritimes (jusqu'à 4)
- ✅ Récupération automatique des horaires via GitHub Actions
- ✅ Génération de fichiers JSON séparés par compagnie
- ✅ Affichage consolidé des horaires de toutes les compagnies sur une seule page
- ✅ Page HTML déployée sur GitHub Pages
- ✅ Mise à jour quotidienne automatique
- ✅ Exécution manuelle possible

## 🏢 Configuration des Compagnies

Le projet supporte plusieurs compagnies maritimes configurées dans le fichier `companies.json`.

### Compagnies actuellement configurées :

1. **Terevau** (configuration complète)
   - Project ID: `terevau-9651d`
   - Database: `https://terevau-9651d.firebaseio.com`

2. **Compagnie 2, 3, 4** (à configurer)
   - Les configurations Firebase doivent être ajoutées dans `companies.json`

### Ajouter une nouvelle compagnie

Éditez le fichier `companies.json` et ajoutez les informations Firebase de la compagnie :

```json
{
  "id": "nom-compagnie",
  "name": "Nom Compagnie",
  "firebase": {
    "apiKey": "VOTRE_API_KEY",
    "authDomain": "votre-projet.firebaseapp.com",
    "databaseURL": "https://votre-projet.firebaseio.com",
    "projectId": "votre-projet",
    "storageBucket": "votre-projet.appspot.com",
    "messagingSenderId": "VOTRE_MESSAGING_SENDER_ID",
    "appId": "VOTRE_APP_ID"
  },
  "color": "#667eea"
}
```

## 🚀 Installation et utilisation locale

### Prérequis
- Python 3.11 ou supérieur
- pip

### Installation
```bash
pip install -r requirements.txt
```

### Récupération des horaires
```bash
python fetch_schedules.py
```

Cela générera :
- `index.html` - Page web avec les horaires
- `data.json` - Données brutes récupérées depuis Firebase

## 📦 GitHub Actions

Le workflow GitHub Actions s'exécute :
- 🕐 **Automatiquement** tous les jours à 6h00 UTC
- 🔄 **Sur push** vers les branches `main` ou `claude/**`
- 👆 **Manuellement** via l'onglet Actions de GitHub

### Configuration de GitHub Pages

Pour activer GitHub Pages :

1. Aller dans **Settings** → **Pages**
2. Sous **Source**, sélectionner **GitHub Actions**
3. La page sera disponible à l'URL affichée

## 📊 Structure du projet

```
moorea-life-schedule/
├── .github/
│   └── workflows/
│       └── fetch-and-deploy.yml  # GitHub Action pour fetch + deploy
├── data/                         # Répertoire des fichiers JSON par compagnie
│   ├── terevau.json             # Données Terevau (généré automatiquement)
│   ├── company2.json            # Données compagnie 2 (généré automatiquement)
│   ├── company3.json            # Données compagnie 3 (généré automatiquement)
│   └── company4.json            # Données compagnie 4 (généré automatiquement)
├── companies.json               # Configuration des compagnies maritimes
├── fetch-schedules.js           # Script Node.js de récupération des horaires
├── package.json                 # Dépendances Node.js
├── index.html                   # Page web multi-compagnies (générée)
└── README.md                    # Ce fichier
```

## 🔍 Comment ça marche

1. **Chargement de la configuration** : Le script lit `companies.json` pour obtenir les configurations Firebase
2. **Connexion Firebase** : Pour chaque compagnie, connexion à sa base Firebase avec sa clé API
3. **Authentification** : Authentification anonyme pour chaque compagnie
4. **Récupération** : Lecture des données depuis Realtime Database pour la semaine en cours
5. **Sauvegarde JSON** : Création d'un fichier JSON par compagnie dans le répertoire `data/`
6. **Génération HTML** : Création d'une page HTML consolidée affichant toutes les compagnies
7. **Déploiement** : GitHub Actions déploie sur GitHub Pages

## 📝 Format des fichiers JSON

Chaque fichier JSON généré contient :
```json
{
  "company": "Nom de la compagnie",
  "companyId": "id-compagnie",
  "week": 47,
  "year": 2025,
  "data": { /* données horaires brutes */ },
  "lastUpdate": "2025-11-21T12:00:00.000Z"
}
```

## 📝 Notes

- Les données sont récupérées depuis les bases Firebase de chaque compagnie configurée
- Si l'accès à une compagnie est restreint, la page affichera un message d'erreur pour cette compagnie
- Les autres compagnies continueront de s'afficher normalement
- Les horaires sont mis à jour automatiquement chaque jour
- Pour ajouter une nouvelle compagnie, il suffit d'éditer `companies.json` avec sa configuration Firebase
