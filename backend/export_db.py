import os
import pandas as pd
from sqlalchemy import create_engine, inspect

# Database connection
engine = create_engine("postgresql://postgres:12345@localhost:5432/khetsaarthi_db")
inspector = inspect(engine)

# Ensure database directory exists
os.makedirs("database", exist_ok=True)

# Loop over every table and save to its own individual .sql file
for table_name in inspector.get_table_names():
    file_path = f"database/{table_name}.sql"
    df = pd.read_sql_table(table_name, con=engine)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"-- Data dump for table: {table_name}\n")
        for idx, row in df.iterrows():
            cols = ", ".join([f'"{col}"' for col in df.columns])
            vals = ", ".join([f"'{str(val).replace('\'', '\'\'')}'" if pd.notna(val) else "NULL" for val in row.values])
            f.write(f'INSERT INTO "{table_name}" ({cols}) VALUES ({vals});\n')
            
    print(f"  └─ Exported: {file_path}")

print("\n All tables exported individually into the 'database/' folder!")