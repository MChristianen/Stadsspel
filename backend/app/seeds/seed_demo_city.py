"""Seed script to populate database with demo city, areas, challenges, and teams."""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from datetime import datetime
from shapely.geometry import Point, Polygon
from geoalchemy2.shape import from_shape

from app.db.session import SessionLocal
from app.db.models import (
    City, Area, Challenge, ChallengeMode, Team, TerritoryOwnership
)
from app.core.security import get_password_hash
from app.core.logging import logger


def seed_demo_city():
    """Create demo city with areas, challenges, and teams."""
    db = SessionLocal()
    
    try:
        # Check if already seeded
        existing_city = db.query(City).filter(City.name == "Demo City").first()
        if existing_city:
            logger.info("Demo city already exists, skipping seed")
            return
        
        logger.info("Starting seed process...")
        
        # Create city
        city = City(
            name="Demo City",
            description="A demo city for testing the stadsspel game"
        )
        db.add(city)
        db.commit()
        db.refresh(city)
        logger.info(f"Created city: {city.name}")
        
        # Define Amsterdam areas - 9 districts covering the whole city without overlap
        # Coordinates form a grid/mosaic that covers Amsterdam completely
        areas_data = [
            {
                "name": "Centrum",
                "description": "Het historische hart van Amsterdam",
                "polygon": [
                    (4.880, 52.365), (4.910, 52.365), (4.910, 52.380),
                    (4.880, 52.380), (4.880, 52.365)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto bij het Centraal Station",
                    "description": "Maak een foto voor het Centraal Station met het gebouw op de achtergrond"
                }
            },
            {
                "name": "Noord",
                "description": "Amsterdam-Noord, bekend om de NDSM werf en Eye Filmmuseum",
                "polygon": [
                    (4.880, 52.380), (4.920, 52.380), (4.920, 52.410),
                    (4.880, 52.410), (4.880, 52.380)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Selfie bij het Eye Filmmuseum",
                    "description": "Maak een selfie met het witte Eye gebouw op de achtergrond"
                }
            },
            {
                "name": "Oost",
                "description": "Amsterdam-Oost met het Oosterpark en de Dappermarkt",
                "polygon": [
                    (4.910, 52.350), (4.960, 52.350), (4.960, 52.380),
                    (4.910, 52.380), (4.910, 52.350)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Kramen tellen op de Dappermarkt",
                    "description": "Tel hoeveel marktkramen je ziet op de Dappermarkt (alleen tijdens marktdagen)"
                }
            },
            {
                "name": "Zuid",
                "description": "Amsterdam-Zuid, chique wijk met het Museumplein",
                "polygon": [
                    (4.850, 52.330), (4.910, 52.330), (4.910, 52.350),
                    (4.850, 52.350), (4.850, 52.330)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Groepsfoto bij het I amsterdam teken",
                    "description": "Maak een groepsfoto bij een I amsterdam teken (let op: origineel is verplaatst!)"
                }
            },
            {
                "name": "West",
                "description": "Amsterdam-West met de Jordaan en Westerpark",
                "polygon": [
                    (4.850, 52.365), (4.880, 52.365), (4.880, 52.390),
                    (4.850, 52.390), (4.850, 52.365)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto van de mooiste gracht",
                    "description": "Vind volgens jouw team de mooiste gracht in de Jordaan en maak een foto"
                }
            },
            {
                "name": "Nieuw-West",
                "description": "Modern Amsterdam met diverse wijken zoals Slotermeer",
                "polygon": [
                    (4.800, 52.350), (4.850, 52.350), (4.850, 52.390),
                    (4.800, 52.390), (4.800, 52.350)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Nationaliteiten tellen",
                    "description": "Tel hoeveel verschillende talen/nationaliteiten je hoort in 10 minuten"
                }
            },
            {
                "name": "Zuidoost",
                "description": "Amsterdam Zuidoost, bekend om de Johan Cruijff ArenA",
                "polygon": [
                    (4.910, 52.300), (4.960, 52.300), (4.960, 52.330),
                    (4.910, 52.330), (4.910, 52.300)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Foto bij de Johan Cruijff ArenA",
                    "description": "Maak een foto bij het stadion (buitenkant is ook goed)"
                }
            },
            {
                "name": "De Pijp",
                "description": "Bruisende wijk met de Albert Cuypmarkt",
                "polygon": [
                    (4.880, 52.350), (4.910, 52.350), (4.910, 52.365),
                    (4.880, 52.365), (4.880, 52.350)
                ],
                "challenge": {
                    "mode": ChallengeMode.HIGHEST_SCORE_WINS,
                    "title": "Verschillende gerechten spotten",
                    "description": "Tel hoeveel verschillende internationale keukens je ziet op de Albert Cuyp"
                }
            },
            {
                "name": "Westerpark",
                "description": "Creatieve wijk rondom het Westerpark",
                "polygon": [
                    (4.850, 52.390), (4.880, 52.390), (4.880, 52.410),
                    (4.850, 52.410), (4.850, 52.390)
                ],
                "challenge": {
                    "mode": ChallengeMode.LAST_APPROVED_WINS,
                    "title": "Street art in het Westerpark",
                    "description": "Vind het meest creatieve stukje street art of graffiti"
                }
            }
        ]
        
        # Create areas and challenges
        created_areas = []
        for area_data in areas_data:
            # Create polygon from coordinates
            polygon = Polygon(area_data["polygon"])
            
            # Calculate center point
            center = polygon.centroid
            
            area = Area(
                city_id=city.id,
                name=area_data["name"],
                description=area_data["description"],
                geom=from_shape(polygon, srid=4326),
                center_point=from_shape(center, srid=4326)
            )
            db.add(area)
            db.commit()
            db.refresh(area)
            created_areas.append(area)
            
            # Create challenge for this area
            challenge_data = area_data["challenge"]
            challenge = Challenge(
                area_id=area.id,
                mode=challenge_data["mode"],
                title=challenge_data["title"],
                description=challenge_data["description"]
            )
            db.add(challenge)
            
            # Create empty ownership record
            ownership = TerritoryOwnership(area_id=area.id)
            db.add(ownership)
            
            logger.info(f"Created area: {area.name} with challenge: {challenge.title}")
        
        db.commit()
        
        # Create demo teams
        teams_data = [
            {"name": "Team Rood", "color": "#FF0000", "is_admin": False},
            {"name": "Team Blauw", "color": "#0000FF", "is_admin": False},
            {"name": "Team Groen", "color": "#00FF00", "is_admin": False},
            {"name": "Team Geel", "color": "#FFFF00", "is_admin": False},
            {"name": "Team Paars", "color": "#800080", "is_admin": False},
            {"name": "Admin Team", "color": "#000000", "is_admin": True},
        ]
        
        for team_data in teams_data:
            team = Team(
                name=team_data["name"],
                password_hash=get_password_hash("password123"),  # Default password
                color=team_data["color"],
                is_admin=team_data["is_admin"]
            )
            db.add(team)
            logger.info(f"Created team: {team.name} (admin: {team.is_admin})")
        
        db.commit()
        
        logger.info("✅ Seed completed successfully!")
        logger.info(f"Created {len(created_areas)} areas with challenges")
        logger.info(f"Created {len(teams_data)} teams")
        logger.info("Default password for all teams: password123")
        
    except Exception as e:
        logger.error(f"Seed failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """Entry point for seed script."""
    seed_demo_city()


if __name__ == "__main__":
    main()
