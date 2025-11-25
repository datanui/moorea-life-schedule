#!/usr/bin/env python3
"""
Moorea Life Schedule - Fetch ferry schedules from Firebase
Fetches ferry schedules for Tahiti-Moorea route from multiple companies
"""

import json
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import requests


def get_week_number(date: datetime) -> int:
    """
    Get ISO week number for a given date

    Args:
        date: Date to get week number for

    Returns:
        ISO week number
    """
    return date.isocalendar()[1]


def get_monday_of_week(week: int, year: int) -> datetime:
    """
    Get the Monday of a specific ISO week

    Args:
        week: ISO week number
        year: Year

    Returns:
        Date of the Monday of that week
    """
    # January 4th is always in week 1
    jan4 = datetime(year, 1, 4)
    # Get the Monday of week 1
    monday_week1 = jan4 - timedelta(days=jan4.weekday())
    # Calculate target Monday
    target_monday = monday_week1 + timedelta(weeks=week - 1)
    return target_monday


def time_to_seconds(time_str: str) -> int:
    """
    Convert time string (HH:MM) to seconds

    Args:
        time_str: Time in format "HH:MM"

    Returns:
        Time in seconds since midnight
    """
    hours, minutes = map(int, time_str.split(':'))
    return hours * 3600 + minutes * 60


def seconds_to_time(seconds: int) -> str:
    """
    Convert seconds to time string (HH:MM)

    Args:
        seconds: Seconds since midnight

    Returns:
        Time string in format "HH:MM"
    """
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    return f"{hours:02d}:{minutes:02d}"


def load_static_schedules(company: Dict, week: int, year: int) -> Dict:
    """
    Load static schedules from a JSON file

    Args:
        company: Company configuration
        week: ISO week number
        year: Year

    Returns:
        Result dictionary with success status and data
    """
    print(f"\n🚢 Traitement de {company['name']} (horaires statiques) - Semaine {week}...")

    try:
        with open(company['scheduleFile'], 'r', encoding='utf-8') as f:
            schedule_data = json.load(f)

        company_data = schedule_data.get(company['name'])

        if not company_data:
            print(f"❌ Aucune donnée trouvée pour {company['name']} dans {company['scheduleFile']}")
            return {
                'success': False,
                'company': company,
                'error': 'Aucune donnée trouvée dans le fichier'
            }

        # Convert static format to Firebase format
        converted_data = {}
        day_mapping = {
            'Lundi': 0,
            'Mardi': 1,
            'Mercredi': 2,
            'Jeudi': 3,
            'Vendredi': 4,
            'Samedi': 5,
            'Dimanche': 6
        }

        # Determine vessel_name (use company name if not specified)
        vessel_name = company.get('vessel_name', company['name'])

        # Convert Tahiti to Moorea schedules
        if 'TahitiVersMoorea' in company_data:
            converted_data['MOZ'] = [{} for _ in range(7)]

            for day_name, times in company_data['TahitiVersMoorea'].items():
                day_index = day_mapping.get(day_name)
                if day_index is not None and isinstance(times, list):
                    for idx, time_str in enumerate(times):
                        converted_data['MOZ'][day_index][f'schedule_{idx}'] = {
                            'day': day_index,
                            'timeBegin': time_to_seconds(time_str),
                            'origin': 'PPT',
                            'destination': 'MOZ',
                            'vessel': company['name'],
                            'vessel_name': vessel_name,
                            'status': 'active'
                        }

        # Convert Moorea to Tahiti schedules
        if 'MooreaVersTahiti' in company_data:
            converted_data['PPT'] = [{} for _ in range(7)]

            for day_name, times in company_data['MooreaVersTahiti'].items():
                day_index = day_mapping.get(day_name)
                if day_index is not None and isinstance(times, list):
                    for idx, time_str in enumerate(times):
                        converted_data['PPT'][day_index][f'schedule_{idx}'] = {
                            'day': day_index,
                            'timeBegin': time_to_seconds(time_str),
                            'origin': 'MOZ',
                            'destination': 'PPT',
                            'vessel': company['name'],
                            'vessel_name': vessel_name,
                            'status': 'active'
                        }

        print(f"✅ Données statiques chargées pour {company['name']}")

        # Save to data/{company-id}_week{week}.json
        os.makedirs('data', exist_ok=True)
        filename = f"data/{company['id']}_week{week}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump({
                'company': company['name'],
                'companyId': company['id'],
                'week': week,
                'year': year,
                'data': converted_data,
                'lastUpdate': datetime.now().isoformat(),
                'source': 'static'
            }, f, indent=2, ensure_ascii=False)
        print(f"💾 Données sauvegardées: {filename}")

        return {
            'success': True,
            'company': company,
            'week': week,
            'year': year,
            'data': converted_data
        }

    except Exception as e:
        print(f"❌ Erreur pour {company['name']}: {str(e)}")
        return {
            'success': False,
            'company': company,
            'error': str(e)
        }


def fetch_company_schedules(company: Dict, week: int, year: int) -> Dict:
    """
    Fetch schedules for a company from Firebase

    Args:
        company: Company configuration with Firebase settings
        week: ISO week number
        year: Year

    Returns:
        Result dictionary with success status and data
    """
    print(f"\n🚢 Traitement de {company['name']} - Semaine {week}...")

    try:
        # Build Firebase REST API URL
        database_url = company['firebase']['databaseURL']
        week_path = f"Calendar/{year}/{week}"
        url = f"{database_url}/{week_path}.json"

        # Add auth parameter if needed
        params = {}
        if company['firebase'].get('apiKey'):
            params['auth'] = company['firebase']['apiKey']

        print(f"🔗 Chemin Firebase: {week_path}")

        # Make request to Firebase REST API
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()

        data = response.json()

        if data:
            print(f"✅ Données récupérées pour {company['name']}")

            # Determine vessel_name (use company name if not specified)
            vessel_name = company.get('vessel_name', company['name'])

            # Add vessel_name to each schedule if not present
            for destination in ['MOZ', 'PPT']:
                if destination in data and isinstance(data[destination], list):
                    for day_data in data[destination]:
                        if day_data and isinstance(day_data, dict):
                            for schedule_id, schedule in day_data.items():
                                if schedule and isinstance(schedule, dict):
                                    if 'vessel_name' not in schedule:
                                        schedule['vessel_name'] = vessel_name
                                    if 'vessel' not in schedule:
                                        schedule['vessel'] = company['name']

            # Save to data/{company-id}_week{week}.json
            os.makedirs('data', exist_ok=True)
            filename = f"data/{company['id']}_week{week}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump({
                    'company': company['name'],
                    'companyId': company['id'],
                    'week': week,
                    'year': year,
                    'data': data,
                    'lastUpdate': datetime.now().isoformat()
                }, f, indent=2, ensure_ascii=False)
            print(f"💾 Données sauvegardées: {filename}")

            return {
                'success': True,
                'company': company,
                'week': week,
                'year': year,
                'data': data
            }
        else:
            print(f"❌ Aucune donnée trouvée pour {company['name']}")
            return {
                'success': False,
                'company': company,
                'error': f"Aucune donnée trouvée pour la semaine {week}"
            }

    except Exception as e:
        print(f"❌ Erreur pour {company['name']}: {str(e)}")
        return {
            'success': False,
            'company': company,
            'error': str(e)
        }


def is_company_configured(company: Dict) -> bool:
    """
    Check if a company is properly configured

    Args:
        company: Company configuration

    Returns:
        True if configured, False otherwise
    """
    # If static schedule company
    if company.get('staticSchedule'):
        return True

    # Check Firebase configuration
    firebase = company.get('firebase')
    if not firebase:
        return False

    # Check for placeholder values
    if (firebase.get('apiKey', '').startswith('YOUR_') or
        'your-project' in firebase.get('databaseURL', '') or
        firebase.get('projectId') == 'your-project'):
        return False

    return True


def parse_schedule_data(data: Dict, current_week: int, current_year: int) -> str:
    """
    Parse schedule data and generate HTML table

    Args:
        data: Schedule data from Firebase or static source
        current_week: Current ISO week number
        current_year: Current year

    Returns:
        HTML string for the schedule table
    """
    if not data or not isinstance(data, dict):
        return '<div class="info">❌ Aucune donnée disponible</div>'

    monday_date = get_monday_of_week(current_week, current_year)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    schedule_by_day = {}

    # Parse data for both directions
    for destination in ['MOZ', 'PPT']:
        if destination not in data or not isinstance(data[destination], list):
            continue

        for day_data in data[destination]:
            if not day_data or not isinstance(day_data, dict):
                continue

            for schedule_id, schedule in day_data.items():
                if not schedule or not isinstance(schedule, dict):
                    continue

                day = schedule.get('day')
                if day is None:
                    continue

                if day not in schedule_by_day:
                    schedule_by_day[day] = {
                        'pptToMoz': [],
                        'mozToPpt': []
                    }

                time_str = seconds_to_time(schedule.get('timeBegin', 0))
                schedule_info = {
                    'time': time_str,
                    'timeBegin': schedule.get('timeBegin', 0),
                    'vessel': schedule.get('vessel', 'N/A'),
                    'status': schedule.get('status')
                }

                if schedule.get('origin') == 'PPT' and schedule.get('destination') == 'MOZ':
                    schedule_by_day[day]['pptToMoz'].append(schedule_info)
                elif schedule.get('origin') == 'MOZ' and schedule.get('destination') == 'PPT':
                    schedule_by_day[day]['mozToPpt'].append(schedule_info)

    # Sort schedules by time
    for day in schedule_by_day:
        schedule_by_day[day]['pptToMoz'].sort(key=lambda x: x['timeBegin'])
        schedule_by_day[day]['mozToPpt'].sort(key=lambda x: x['timeBegin'])

    # Generate HTML rows
    rows = []
    days_of_week = sorted(schedule_by_day.keys())

    for day in days_of_week:
        current_date = monday_date + timedelta(days=day)

        date_str = current_date.strftime('%A %d %B').capitalize()
        # Translate day names to French
        day_names = {
            'Monday': 'Lundi',
            'Tuesday': 'Mardi',
            'Wednesday': 'Mercredi',
            'Thursday': 'Jeudi',
            'Friday': 'Vendredi',
            'Saturday': 'Samedi',
            'Sunday': 'Dimanche'
        }
        for en, fr in day_names.items():
            date_str = date_str.replace(en, fr)

        # Translate month names to French
        month_names = {
            'January': 'janvier', 'February': 'février', 'March': 'mars',
            'April': 'avril', 'May': 'mai', 'June': 'juin',
            'July': 'juillet', 'August': 'août', 'September': 'septembre',
            'October': 'octobre', 'November': 'novembre', 'December': 'décembre'
        }
        for en, fr in month_names.items():
            date_str = date_str.replace(en, fr)

        ppt_to_moz_times = schedule_by_day[day]['pptToMoz']
        ppt_to_moz_html = ' '.join([
            f'<span class="time-badge">{s["time"]}</span>'
            for s in ppt_to_moz_times
        ]) if ppt_to_moz_times else '<span style="color: #999;">-</span>'

        moz_to_ppt_times = schedule_by_day[day]['mozToPpt']
        moz_to_ppt_html = ' '.join([
            f'<span class="time-badge">{s["time"]}</span>'
            for s in moz_to_ppt_times
        ]) if moz_to_ppt_times else '<span style="color: #999;">-</span>'

        is_today = current_date.date() == today.date()
        row_class = 'today' if is_today else ''

        rows.append(f'''
      <tr class="{row_class}">
        <td class="date-cell">{date_str}</td>
        <td class="times-cell">{ppt_to_moz_html}</td>
        <td class="times-cell">{moz_to_ppt_html}</td>
      </tr>
    ''')

    if not rows:
        return '<div class="info">❌ Aucun horaire trouvé dans les données</div>'

    return f'''
    <table class="schedule-table">
      <thead>
        <tr>
          <th>📅 Date</th>
          <th>🚢 Départs Papeete → Moorea</th>
          <th>🚢 Départs Moorea → Papeete</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows)}
      </tbody>
    </table>
  '''


def generate_multi_company_html(results: List[Dict], current_week: int, current_year: int):
    """
    Generate HTML page with schedules for all companies using unified horaires.json

    Args:
        results: List of fetch results for each company (not used, kept for compatibility)
        current_week: Current ISO week number
        current_year: Current year
    """
    now = datetime.now()

    # Load unified schedules from horaires.json
    try:
        with open('horaires.json', 'r', encoding='utf-8') as f:
            all_schedules = json.load(f)
    except FileNotFoundError:
        all_schedules = []

    # Separate schedules by direction
    tahiti_to_moorea = []
    moorea_to_tahiti = []

    for schedule in all_schedules:
        # Translate day names to French
        day_translation = {
            'Monday': 'Lundi',
            'Tuesday': 'Mardi',
            'Wednesday': 'Mercredi',
            'Thursday': 'Jeudi',
            'Friday': 'Vendredi',
            'Saturday': 'Samedi',
            'Sunday': 'Dimanche'
        }
        jour_fr = day_translation.get(schedule['jour'], schedule['jour'])

        # Format: "Lundi 25 novembre - 08:30"
        date_obj = datetime.fromisoformat(schedule['timestamp'])
        month_names_fr = {
            1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
            7: 'juillet', 8: 'août', 9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'décembre'
        }
        date_formatted = f"{jour_fr} {date_obj.day} {month_names_fr[date_obj.month]}"

        schedule_entry = {
            'bateau': schedule['bateau'],
            'date_heure': f"{date_formatted} - {schedule['heure']}",
            'timestamp': schedule['timestamp'],
            'date': date_obj
        }

        if schedule['origine'] == 'PPT' and schedule['destination'] == 'MOZ':
            tahiti_to_moorea.append(schedule_entry)
        elif schedule['origine'] == 'MOZ' and schedule['destination'] == 'PPT':
            moorea_to_tahiti.append(schedule_entry)

    # Sort by timestamp
    tahiti_to_moorea.sort(key=lambda x: x['timestamp'])
    moorea_to_tahiti.sort(key=lambda x: x['timestamp'])

    # Generate table rows for Tahiti to Moorea
    tahiti_moorea_rows = []
    for schedule in tahiti_to_moorea:
        is_today = schedule['date'].date() == now.date()
        row_class = 'today' if is_today else ''
        tahiti_moorea_rows.append(f'''
          <tr class="{row_class}">
            <td class="vessel-cell">{schedule['bateau']}</td>
            <td class="datetime-cell">{schedule['date_heure']}</td>
          </tr>
        ''')

    # Generate table rows for Moorea to Tahiti
    moorea_tahiti_rows = []
    for schedule in moorea_to_tahiti:
        is_today = schedule['date'].date() == now.date()
        row_class = 'today' if is_today else ''
        moorea_tahiti_rows.append(f'''
          <tr class="{row_class}">
            <td class="vessel-cell">{schedule['bateau']}</td>
            <td class="datetime-cell">{schedule['date_heure']}</td>
          </tr>
        ''')

    # French date formatting
    day_names = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
    month_names = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

    weekday = day_names[now.weekday()]
    month = month_names[now.month - 1]
    date_formatted = f"{weekday} {now.day} {month} {now.year}"

    # Determine next week for display
    next_week_date = now + timedelta(weeks=1)
    next_week = get_week_number(next_week_date)

    html = f'''<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horaires Ferries Tahiti-Moorea - Toutes Compagnies</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1400px;
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
        h2 {{
            color: #764ba2;
            margin-top: 30px;
            margin-bottom: 15px;
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
        .schedule-table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
        }}
        .schedule-table thead {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }}
        .schedule-table th {{
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 16px;
        }}
        .schedule-table td {{
            padding: 12px 15px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .schedule-table tbody tr:hover {{
            background: #f8f9fa;
        }}
        .schedule-table tbody tr:last-child td {{
            border-bottom: none;
        }}
        .vessel-cell {{
            font-weight: 600;
            color: #667eea;
        }}
        .datetime-cell {{
            font-family: 'Courier New', monospace;
            font-size: 14px;
        }}
        .today {{
            background: #fff9e6 !important;
        }}
        .today .vessel-cell {{
            color: #f5576c;
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
        <div class="subtitle">Semaines {current_week} et {next_week} de {current_year} - {date_formatted}</div>

        <div class="info">
            <strong>ℹ️ Informations:</strong><br>
            Cette page affiche les horaires de toutes les compagnies maritimes desservant la liaison Tahiti-Moorea pour les deux prochaines semaines.<br>
            Dernière mise à jour: {now.strftime('%d/%m/%Y à %H:%M:%S')}
        </div>

        <h2>🚢 Départs Papeete → Moorea</h2>
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>Nom du Bateau</th>
                    <th>Jour et Heure du Départ</th>
                </tr>
            </thead>
            <tbody>
                {''.join(tahiti_moorea_rows) if tahiti_moorea_rows else '<tr><td colspan="2">Aucun horaire disponible</td></tr>'}
            </tbody>
        </table>

        <h2>🚢 Départs Moorea → Papeete</h2>
        <table class="schedule-table">
            <thead>
                <tr>
                    <th>Nom du Bateau</th>
                    <th>Jour et Heure du Départ</th>
                </tr>
            </thead>
            <tbody>
                {''.join(moorea_tahiti_rows) if moorea_tahiti_rows else '<tr><td colspan="2">Aucun horaire disponible</td></tr>'}
            </tbody>
        </table>

        <div class="footer">
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
            <p>Projet: Moorea Life Schedule</p>
        </div>
    </div>
</body>
</html>'''

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("✅ Page HTML multi-compagnies générée: index.html")


def generate_error_html(error_message: str):
    """
    Generate error HTML page

    Args:
        error_message: Error message to display
    """
    now = datetime.now()

    html = f'''<!DOCTYPE html>
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
            <p>Date de la tentative: {now.strftime('%d/%m/%Y à %H:%M:%S')}</p>
            <p>🔄 Page générée automatiquement via GitHub Actions</p>
        </div>
    </div>
</body>
</html>'''

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("⚠️  Page HTML d'erreur générée: index.html")


def create_unified_horaires_json(all_results: List[Dict]):
    """
    Create a unified horaires.json file with all schedules from all companies for all weeks

    Args:
        all_results: List of all fetch results (all companies, all weeks)
    """
    print("\n📦 Création du fichier horaires.json unifié...")

    unified_schedules = []

    for result in all_results:
        if not result['success']:
            continue

        company = result['company']
        week = result['week']
        year = result['year']
        data = result['data']

        # Get Monday of the week
        monday_date = get_monday_of_week(week, year)

        # Process schedules
        for destination in ['MOZ', 'PPT']:
            if destination not in data or not isinstance(data[destination], list):
                continue

            for day_data in data[destination]:
                if not day_data or not isinstance(day_data, dict):
                    continue

                for schedule_id, schedule in day_data.items():
                    if not schedule or not isinstance(schedule, dict):
                        continue

                    day = schedule.get('day')
                    if day is None:
                        continue

                    # Calculate actual date
                    actual_date = monday_date + timedelta(days=day)

                    # Get vessel name
                    vessel_name = schedule.get('vessel_name', company.get('vessel_name', company['name']))

                    # Create schedule entry
                    unified_schedules.append({
                        'bateau': vessel_name,
                        'compagnie': company['name'],
                        'origine': schedule.get('origin', ''),
                        'destination': schedule.get('destination', ''),
                        'date': actual_date.strftime('%Y-%m-%d'),
                        'jour': actual_date.strftime('%A'),
                        'heure': seconds_to_time(schedule.get('timeBegin', 0)),
                        'timestamp': actual_date.replace(
                            hour=schedule.get('timeBegin', 0) // 3600,
                            minute=(schedule.get('timeBegin', 0) % 3600) // 60
                        ).isoformat(),
                        'statut': schedule.get('status', 'active')
                    })

    # Sort by timestamp
    unified_schedules.sort(key=lambda x: x['timestamp'])

    # Save to horaires.json
    with open('horaires.json', 'w', encoding='utf-8') as f:
        json.dump(unified_schedules, f, indent=2, ensure_ascii=False)

    print(f"✅ Fichier horaires.json créé avec {len(unified_schedules)} horaires")
    return unified_schedules


def fetch_all_schedules():
    """Main function to fetch all schedules"""
    try:
        print("📋 Chargement de la configuration des compagnies...")

        # Load companies configuration
        with open('companies.json', 'r', encoding='utf-8') as f:
            companies_config = json.load(f)

        all_companies = companies_config['companies']

        # Filter only configured companies
        companies = [c for c in all_companies if is_company_configured(c)]

        print(f"✅ {len(companies)} compagnie(s) configurée(s) sur {len(all_companies)} au total")

        # Calculate current week and next week
        now = datetime.now()
        current_week = get_week_number(now)
        current_year = now.year

        # Calculate next week
        next_week_date = now + timedelta(weeks=1)
        next_week = get_week_number(next_week_date)
        next_week_year = next_week_date.year

        print(f"📅 Récupération des semaines {current_week} et {next_week} de {current_year}")

        # Create data directory if it doesn't exist
        os.makedirs('data', exist_ok=True)

        # Fetch schedules for each company for both weeks
        all_results = []
        for company in companies:
            for week, year in [(current_week, current_year), (next_week, next_week_year)]:
                if company.get('staticSchedule'):
                    # Load from static file
                    result = load_static_schedules(company, week, year)
                else:
                    # Fetch from Firebase
                    result = fetch_company_schedules(company, week, year)

                all_results.append(result)

        # Create unified horaires.json
        unified_schedules = create_unified_horaires_json(all_results)

        # Generate HTML page with unified schedules
        generate_multi_company_html(all_results, current_week, current_year)

        print("\n✅ Processus terminé avec succès!")
        return 0

    except Exception as e:
        print(f"❌ Erreur générale: {e}")
        import traceback
        traceback.print_exc()
        generate_error_html(str(e))
        return 1


if __name__ == '__main__':
    sys.exit(fetch_all_schedules())
