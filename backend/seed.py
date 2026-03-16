"""Seed the database with demo data."""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import init_db, async_session
from app.models.user import User
from app.models.event import Event
from app.models.registration import Registration
from app.models.notification import Notification
from app.models.audit_log import AuditLog
from app.utils.auth import hash_password
from app.utils.qr import generate_qr_token
from datetime import date, time, datetime


async def seed():
    await init_db()

    async with async_session() as db:
        # Check if already seeded
        from sqlalchemy import select, func
        count = await db.execute(select(func.count(User.id)))
        if count.scalar() > 0:
            print("Database already has data. Skipping seed.")
            return

        # 1. Create users
        admin = User(name="College Admin", email="admin@college.edu",
                     password_hash=hash_password("admin123"),
                     role="college_admin", department="Administration")
        organizer = User(name="Prof Smith", email="smith@college.edu",
                         password_hash=hash_password("org123"),
                         role="organizer", department="Computer Science")
        organizer2 = User(name="Dr. Priya", email="priya@college.edu",
                          password_hash=hash_password("org123"),
                          role="organizer", department="ECE")
        student1 = User(name="Rahul Kumar", email="rahul@student.edu",
                        password_hash=hash_password("stu123"),
                        role="student", department="Computer Science")
        student2 = User(name="Aisha Patel", email="aisha@student.edu",
                        password_hash=hash_password("stu123"),
                        role="student", department="Computer Science")
        student3 = User(name="Vikram Singh", email="vikram@student.edu",
                        password_hash=hash_password("stu123"),
                        role="student", department="ECE")

        db.add_all([admin, organizer, organizer2, student1, student2, student3])
        await db.flush()
        print(f"✅ Created {6} users")

        # 2. Create events
        events_data = [
            Event(title="Cybersecurity Workshop", description="Learn about OWASP Top 10 vulnerabilities, penetration testing tools, and secure coding practices with hands-on labs.",
                  date=date(2026, 3, 25), time=time(10, 0), venue="Seminar Hall A", capacity=150,
                  category="Technical", organizer_id=organizer.id, status="published",
                  registration_deadline=date(2026, 3, 23)),
            Event(title="AI & Machine Learning Symposium", description="Exploring the frontiers of artificial intelligence with industry speakers from Google, Microsoft, and OpenAI.",
                  date=date(2026, 4, 5), time=time(9, 0), venue="Main Auditorium", capacity=300,
                  category="Technical", organizer_id=organizer.id, status="published",
                  registration_deadline=date(2026, 4, 3)),
            Event(title="Annual Cultural Fest", description="Dance, music, drama, art exhibitions, and food stalls from across departments.",
                  date=date(2026, 4, 15), time=time(16, 0), venue="Open Air Theatre", capacity=500,
                  category="Cultural", organizer_id=organizer2.id, status="published",
                  registration_deadline=date(2026, 4, 12)),
            Event(title="Inter-College Cricket Tournament", description="T20 format tournament with 8 participating colleges. Register your team now!",
                  date=date(2026, 4, 20), time=time(8, 0), venue="Sports Ground", capacity=200,
                  category="Sports", organizer_id=organizer2.id, status="published",
                  registration_deadline=date(2026, 4, 18)),
            Event(title="Blockchain Seminar", description="Understanding decentralized systems, smart contracts, and Web3 development.",
                  date=date(2026, 5, 1), time=time(14, 0), venue="Room 301", capacity=80,
                  category="Seminar", organizer_id=organizer.id, status="pending",
                  registration_deadline=date(2026, 4, 28)),
            Event(title="IoT Hands-on Workshop", description="Build real IoT projects using Arduino, Raspberry Pi, and cloud platforms.",
                  date=date(2026, 5, 10), time=time(10, 0), venue="Lab 201", capacity=40,
                  category="Workshop", organizer_id=organizer.id, status="draft",
                  registration_deadline=date(2026, 5, 8)),
        ]
        db.add_all(events_data)
        await db.flush()
        print(f"✅ Created {len(events_data)} events")

        # 3. Register students for published events
        published_events = [e for e in events_data if e.status == "published"]
        students = [student1, student2, student3]
        reg_count = 0
        for student in students:
            for ev in published_events[:3]:  # Register for first 3 published events
                qr = generate_qr_token(ev.id, student.id)
                reg = Registration(user_id=student.id, event_id=ev.id,
                                   status="confirmed", qr_token=qr)
                db.add(reg)
                reg_count += 1

                notif = Notification(user_id=student.id, event_id=ev.id,
                                     message=f"Registration confirmed for '{ev.title}' on {ev.date}",
                                     type="confirmation", status="unread")
                db.add(notif)

        await db.flush()
        print(f"✅ Created {reg_count} registrations")

        # 4. Add some audit logs
        logs = [
            AuditLog(user_id=admin.id, action="USER_REGISTER", details="Admin account created", ip_address="127.0.0.1"),
            AuditLog(user_id=organizer.id, action="EVENT_CREATED", details="Created: Cybersecurity Workshop", ip_address="192.168.1.10"),
            AuditLog(user_id=organizer.id, action="EVENT_CREATED", details="Created: AI & ML Symposium", ip_address="192.168.1.10"),
            AuditLog(user_id=admin.id, action="EVENT_APPROVED", details="Approved: Cybersecurity Workshop", ip_address="127.0.0.1"),
            AuditLog(user_id=student1.id, action="REGISTRATION", details="Registered for Cybersecurity Workshop", ip_address="10.0.0.5"),
            AuditLog(user_id=student2.id, action="REGISTRATION", details="Registered for AI & ML Symposium", ip_address="10.0.0.12"),
            AuditLog(user_id=student1.id, action="LOGIN_SUCCESS", details="User logged in: rahul@student.edu", ip_address="10.0.0.5"),
        ]
        db.add_all(logs)
        print(f"✅ Created {len(logs)} audit logs")

        # 5. Add reminder notifications
        for student in students:
            notif = Notification(user_id=student.id, event_id=published_events[0].id,
                                 message=f"Reminder: '{published_events[0].title}' is coming up on {published_events[0].date}!",
                                 type="reminder", status="unread")
            db.add(notif)

        await db.commit()
        print("\n🎉 Database seeded successfully!")
        print("\n📋 Test Accounts:")
        print("  Admin:     admin@college.edu / admin123")
        print("  Organizer: smith@college.edu / org123")
        print("  Student:   rahul@student.edu / stu123")
        print("  Student:   aisha@student.edu / stu123")


if __name__ == "__main__":
    asyncio.run(seed())
