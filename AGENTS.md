# Project Agent Instructions

## Data Warehouse Conventions

### Query vs Write Policy
- **Use Presto for reading/querying data** - Presto is optimized for fast analytical queries
- **Use Spark for writing data** - Spark is used for ETL jobs and writing to Hudi tables

### Connection Details
- **Presto**: `jdbc:presto://172.16.100.213:9666/hive`
- **Spark Connect**: `sc://172.16.100.212:15002`

### Database Structure
- **Source**: MySQL `usr_skyee_mw` database
- **Warehouse**: Hive/Hudi tables in `usr_skyee_mw` database
- **Table prefix**: `stg_` for staging tables synced from MySQL

### ETL Scripts
- Location: `dags/usr_skyee_mw/python/`
- Pattern: `stg_{table_name}.py` for each table
- Base class: `MySqlEtl` from `utils/etl.py`
- Partition: `dt` column derived from `CREATE_TIME`
- Filter: `CREATE_TIME` for incremental extraction
- Hudi mode: `insert_overwrite` for daily incremental

### Airflow DAG
- DAG ID: `usr_skyee_mw`
- Schedule: Daily at 02:00 AM
- Variables:
  - `MYSQL_DB_URL_SECRET`: MySQL connection (without `jdbc:mysql://` prefix)
  - `SPARK_CONNECT_URL`: Spark Connect server URL

### Backfill
- Script: `dags/usr_skyee_mw/python/backfill.py`
- Processes month by month
- Usage: `python backfill.py --url <jdbc_url> --spark-remote <spark_url> --start-date YYYY-MM-DD --end-date YYYY-MM-DD`

## Python Package Management
- Use `uv` for Python package management
- Create venv: `uv venv`
- Install packages: `uv pip install <package>`
- Activate: `source .venv/bin/activate`

## Query vs Write Policy
- **Use Presto for reading/querying data** - Presto is optimized for fast analytical queries
- **Use Spark for writing data** - Spark is used for ETL jobs and writing to Hudi tables
- Run both from local machine via network

## Connection Details (from local machine)
- **Presto**: `172.16.100.213:9666` (catalog: `hive`, schema: `usr_skyee_mw`)
- **Spark Connect**: `sc://172.16.100.212:15002`
- **MySQL**: `rm-wz9o2jhv000avcrs5.mysql.rds.aliyuncs.com/usr_skyee_mw`

## Cloud Build Conventions
- **Never use `gcloud builds submit`** — always deploy via Cloud Build triggers (push-to-main)
- Triggers are configured in GCP Console → Cloud Build → Triggers
- If a trigger doesn't exist, ask the human to create it (requires GitHub connection setup)
- Cloudbuild files: `frontend/graph-demo/cloudbuild.yaml`
- Service: `skyee-graph-demo` in `asia-east2`
