"""
Seed verified demo policies for local demos (run from backend/).
  python scripts/seed_demo_policies.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from datetime import datetime, timezone

from sqlalchemy import select, func

from app.db.models import (
    Policy, PolicyPillar, PolicyStatus, PolicyUrgency, ReviewStatus, Source,
)
from app.db.session import db_context


DEMO_POLICIES = [
    {
        "title": "SEBI Master Circular on Business Responsibility and Sustainability Reporting (BRSR)",
        "jurisdiction": "India",
        "pillar": PolicyPillar.G,
        "sectors": ["Finance", "Manufacturing"],
        "status": PolicyStatus.Enacted,
        "urgency": PolicyUrgency.High,
        "summary": "SEBI has updated BRSR disclosure requirements for listed entities, expanding scope and assurance expectations. CSOs should align FY26 reporting calendars and data collection with the revised core and leadership indicators. Immediate action: validate gap analysis against the latest master circular.",
    },
    {
        "title": "EU Corporate Sustainability Reporting Directive (CSRD) — ESRS Implementation Update",
        "jurisdiction": "EU",
        "pillar": PolicyPillar.G,
        "sectors": ["Finance", "Technology"],
        "status": PolicyStatus.Consultation,
        "urgency": PolicyUrgency.Medium,
        "summary": "The European Commission published additional guidance on ESRS application for in-scope undertakings. Finance and technology groups with EU subsidiaries should review materiality processes and value-chain data requests. No immediate filing obligation, but consultation responses may shape final Q&A.",
    },
    {
        "title": "MoEFCC Notification on Extended Producer Responsibility for Plastic Packaging",
        "jurisdiction": "India",
        "pillar": PolicyPillar.E,
        "sectors": ["FMCG", "Manufacturing"],
        "status": PolicyStatus.Enacted,
        "urgency": PolicyUrgency.Critical,
        "summary": "MoEFCC issued amended EPR targets for plastic packaging categories with revised collection and recycling certificates. FMCG and manufacturing CSOs must update producer responsibility plans and vendor contracts within the compliance window. Non-compliance may attract penalties under the Plastic Waste Management Rules.",
    },
    {
        "title": "RBI Draft Guidelines on Climate Risk Disclosures for Banks and NBFCs",
        "jurisdiction": "India",
        "pillar": PolicyPillar.G,
        "sectors": ["Finance"],
        "status": PolicyStatus.Proposed,
        "urgency": PolicyUrgency.High,
        "summary": "RBI released draft disclosure norms on climate-related financial risks for regulated entities. Banks and NBFCs should prepare scenario analysis capabilities and governance disclosures ahead of formal adoption. Engage with industry consultations to influence implementation timelines.",
    },
    {
        "title": "ISSB IFRS S1 and S2 — Jurisdictional Adoption Roadmap (2025 Update)",
        "jurisdiction": "Global",
        "pillar": PolicyPillar.G,
        "sectors": ["Finance", "Energy"],
        "status": PolicyStatus.Enacted,
        "urgency": PolicyUrgency.Medium,
        "summary": "The ISSB updated its jurisdictional adoption tracker for IFRS Sustainability Disclosure Standards. Multinationals should map which entities will apply S1/S2 in 2025–2026 and harmonise with CSRD where dual reporting applies. Align investor communications to the adoption timeline in each market.",
    },
]


async def main():
    async with db_context() as db:
        verified_count = (
            await db.execute(
                select(func.count()).select_from(Policy).where(
                    Policy.review_status == ReviewStatus.verified
                )
            )
        ).scalar_one()

        if verified_count >= 3:
            print(f"Already have {verified_count} verified policies — skipping seed.")
            return

        src = (
            await db.execute(select(Source).where(Source.is_active == True).limit(1))
        ).scalar_one_or_none()

        for i, demo in enumerate(DEMO_POLICIES):
            policy = Policy(
                title=demo["title"],
                source_id=src.id if src else None,
                source_url=f"https://bevolve.ai/demo-policy-{i + 1}",
                jurisdiction=demo["jurisdiction"],
                pillar=demo["pillar"],
                sectors=demo["sectors"],
                status=demo["status"],
                urgency=demo["urgency"],
                summary=demo["summary"],
                review_status=ReviewStatus.verified,
                verified_by="seed-demo",
                verified_at=datetime.now(timezone.utc),
                published_date=datetime.now(timezone.utc),
            )
            db.add(policy)

        print(f"Seeded {len(DEMO_POLICIES)} verified demo policies.")


if __name__ == "__main__":
    asyncio.run(main())
