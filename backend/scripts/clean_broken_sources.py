# clean_broken_sources.py
import sqlite3

def clean():
    db_path = "esglens.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    broken_sources = [
        "Reuters Sustainability",
        "CDP — Carbon Disclosure Project",
        "EU Taxonomy Platform",
        "TCFD — Task Force on Climate-related Financial Disclosures"
    ]
    
    # Delete them from the database
    cursor.execute(
        "DELETE FROM sources WHERE name IN (?, ?, ?, ?)",
        broken_sources
    )
    conn.commit()
    print(f"Successfully deleted {cursor.rowcount} decommissioned/broken sources from the database.")
    
    # Print the remaining sources
    cursor.execute("SELECT id, name, fetch_strategy FROM sources ORDER BY name")
    print("\nRemaining sources in database:")
    for row in cursor.fetchall():
        print(f" - #{row[0]}: {row[1]} ({row[2]})")
        
    conn.close()

if __name__ == "__main__":
    clean()
