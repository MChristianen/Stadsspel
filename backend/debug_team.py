"""Debug script to check team and session status"""
from app.db.session import SessionLocal
from app.db.models import Team, GameSession, Area
from datetime import datetime

db = SessionLocal()

print("=" * 60)
print("TEAM DEBUG INFO")
print("=" * 60)

# Check teamdvo
team = db.query(Team).filter(Team.name == 'teamdvo').first()
if not team:
    print("❌ teamdvo not found!")
    db.close()
    exit(1)

print(f"\n📋 TEAM INFO:")
print(f"  ID: {team.id}")
print(f"  Name: {team.name}")
print(f"  game_session_id: {team.game_session_id}")
print(f"  is_admin: {team.is_admin}")

if not team.game_session_id:
    print("\n❌ ERROR: Team has no game_session_id!")
    db.close()
    exit(1)

# Check session
session = db.query(GameSession).filter(GameSession.id == team.game_session_id).first()
if not session:
    print(f"\n❌ ERROR: Session {team.game_session_id} not found!")
    db.close()
    exit(1)

print(f"\n🎮 SESSION INFO:")
print(f"  ID: {session.id}")
print(f"  city_id: {session.city_id}")
print(f"  is_active: {session.is_active}")
print(f"  started_at: {session.started_at}")
print(f"  end_time: {session.end_time}")
print(f"  is_finished: {session.is_finished}")

now = datetime.utcnow()
print(f"\n⏰ TIME CHECK:")
print(f"  Current time (UTC): {now}")
print(f"  Session ends at: {session.end_time}")
if now >= session.end_time:
    print(f"  ❌ Session has ENDED!")
else:
    remaining = (session.end_time - now).total_seconds()
    print(f"  ✅ Session still active ({remaining/60:.1f} minutes remaining)")

# Check areas
areas = db.query(Area).filter(Area.city_id == session.city_id).all()
print(f"\n🗺️  AREAS IN SESSION CITY:")
print(f"  Total areas: {len(areas)}")
for area in areas[:3]:
    print(f"    - {area.name} (ID: {area.id})")
if len(areas) > 3:
    print(f"    ... and {len(areas) - 3} more")

print("\n" + "=" * 60)
if session.is_active and now < session.end_time:
    print("✅ Team should be able to submit!")
else:
    if not session.is_active:
        print("❌ Session is not active!")
    if now >= session.end_time:
        print("❌ Session has ended!")

db.close()
