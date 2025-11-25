#!/usr/bin/env python3
"""
Test script to verify vessel name parsing for Aremiti data
"""

import json
from fetch_schedules import parse_vessel_name

def test_vessel_parsing():
    """Test the vessel name parsing function"""
    print("🧪 Test de la fonction parse_vessel_name\n")

    test_cases = [
        ("Aremiti 5-26v", "Aremiti 5"),
        ("Aremiti 6-30v", "Aremiti 6"),
        ("Aremiti 5-1a", "Aremiti 5"),
        ("Terevau", "Terevau"),
        ("Aremiti 5", "Aremiti 5"),
        ("Vaeara'i-12x", "Vaeara'i"),
    ]

    all_passed = True
    for input_val, expected in test_cases:
        result = parse_vessel_name(input_val)
        passed = result == expected
        all_passed = all_passed and passed
        status = "✅" if passed else "❌"
        print(f"{status} '{input_val}' -> '{result}' (attendu: '{expected}')")

    print()
    return all_passed

def simulate_firebase_data():
    """Simulate Firebase data structure with Aremiti vessels"""
    print("🔬 Simulation de données Firebase pour Aremiti\n")

    # Simulated Firebase data structure
    firebase_data = {
        "MOZ": [
            {  # Day 0 (Monday)
                "schedule_0": {
                    "day": 0,
                    "timeBegin": 21600,  # 06:00
                    "origin": "PPT",
                    "destination": "MOZ",
                    "vessel": "Aremiti 5-26v",
                    "status": "active"
                },
                "schedule_1": {
                    "day": 0,
                    "timeBegin": 28800,  # 08:00
                    "origin": "PPT",
                    "destination": "MOZ",
                    "vessel": "Aremiti 6-30v",
                    "status": "active"
                }
            }
        ],
        "PPT": [
            {  # Day 0 (Monday)
                "schedule_0": {
                    "day": 0,
                    "timeBegin": 25200,  # 07:00
                    "origin": "MOZ",
                    "destination": "PPT",
                    "vessel": "Aremiti 5-26v",
                    "status": "active"
                }
            }
        ]
    }

    # Simulate the processing logic from fetch_company_schedules
    for destination in ['MOZ', 'PPT']:
        if destination in firebase_data and isinstance(firebase_data[destination], list):
            for day_data in firebase_data[destination]:
                if day_data and isinstance(day_data, dict):
                    for schedule_id, schedule in day_data.items():
                        if schedule and isinstance(schedule, dict):
                            # Extract vessel_name from the 'vessel' field if present
                            if 'vessel' in schedule and schedule['vessel']:
                                # Parse vessel name to remove suffixes like "-26v"
                                raw_vessel = schedule['vessel']
                                clean_vessel_name = parse_vessel_name(raw_vessel)
                                schedule['vessel_name'] = clean_vessel_name

    # Display results
    print("Données après traitement:\n")
    print(json.dumps(firebase_data, indent=2, ensure_ascii=False))
    print()

    # Verify the vessel_name fields
    print("Vérification des noms de bateaux extraits:")
    expected_vessels = ["Aremiti 5", "Aremiti 6"]
    found_vessels = set()

    for destination in ['MOZ', 'PPT']:
        if destination in firebase_data:
            for day_data in firebase_data[destination]:
                if day_data:
                    for schedule_id, schedule in day_data.items():
                        if 'vessel_name' in schedule:
                            vessel_name = schedule['vessel_name']
                            found_vessels.add(vessel_name)
                            raw = schedule.get('vessel', 'N/A')
                            print(f"  ✅ {raw} -> {vessel_name}")

    print()

    # Check if all expected vessels were found
    all_found = all(v in found_vessels for v in expected_vessels)
    if all_found:
        print("✅ Tous les bateaux Aremiti ont été correctement identifiés!")
    else:
        print(f"❌ Certains bateaux manquent. Trouvés: {found_vessels}, Attendus: {expected_vessels}")

    print()
    return all_found

if __name__ == '__main__':
    print("=" * 60)
    print("Test de l'extraction des noms de bateaux Aremiti")
    print("=" * 60)
    print()

    # Run tests
    test1_passed = test_vessel_parsing()
    test2_passed = simulate_firebase_data()

    # Summary
    print("=" * 60)
    print("Résumé des tests:")
    print("=" * 60)
    print(f"Test 1 - Fonction parse_vessel_name: {'✅ RÉUSSI' if test1_passed else '❌ ÉCHOUÉ'}")
    print(f"Test 2 - Simulation Firebase:        {'✅ RÉUSSI' if test2_passed else '❌ ÉCHOUÉ'}")
    print()

    if test1_passed and test2_passed:
        print("🎉 Tous les tests sont passés! Le système est prêt à extraire les noms des bateaux Aremiti.")
    else:
        print("⚠️  Certains tests ont échoué.")

    exit(0 if (test1_passed and test2_passed) else 1)
