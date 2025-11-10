# 🚢 Moorea Life Schedule

Projet pour récupérer et afficher les horaires des ferries Tahiti-Moorea depuis les bases de données Firebase des compagnies maritimes.

## 📋 Fonctionnalités

- ✅ Récupération automatique des horaires via GitHub Actions
- ✅ Affichage des horaires de la semaine en cours
- ✅ Page HTML déployée sur GitHub Pages
- ✅ Mise à jour quotidienne automatique
- ✅ Exécution manuelle possible

## 🔧 Configuration Firebase

Le projet utilise la clé API publique de terevau.pf pour accéder à la base de données Firebase.

- **Project ID:** `terevau-9651d`
- **Database:** `https://terevau-9651d.firebaseio.com`
- **API Key:** `AIzaSyB0wkLX44cZtk4lIDSVOQiOFwvts-Wqm3I`

## 🚀 Installation et utilisation locale

### Prérequis
- Node.js 20 ou supérieur
- npm

### Installation
```bash
npm install
```

### Récupération des horaires
```bash
npm run fetch
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
├── fetch-schedules.js            # Script de récupération des horaires
├── package.json                  # Dépendances du projet
├── index.html                    # Page générée (après exécution)
├── data.json                     # Données brutes (après exécution)
└── README.md                     # Ce fichier
```

## 🔍 Comment ça marche

1. **Connexion Firebase** : Le script se connecte à Firebase avec la clé API publique
2. **Authentification** : Tentative d'authentification anonyme
3. **Récupération** : Lecture des données depuis Realtime Database
4. **Génération** : Création d'une page HTML avec les horaires
5. **Déploiement** : GitHub Actions déploie sur GitHub Pages

## 📝 Notes

- Les données sont récupérées depuis la base Firebase publique de terevau.pf
- Si l'accès est restreint, la page affichera un message d'erreur explicite
- Les horaires sont mis à jour automatiquement chaque jour
