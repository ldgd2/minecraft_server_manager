import typer
import sys
import os

# Add parent directory to sys.path to allow imports from project root when running standalone
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database.migrate import run_migrations, rollback_migration, reset_database, show_current, show_history, create_database
from database.seeder import run_all_seeders, run_specific_seeder, seed_users, seed_servers, seed_bitacora, seed_versions # Explicit imports to ensure availability if needed
from dev.utils import print_header, print_success, print_error, print_info

app = typer.Typer(help="Database management commands")

@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        from rich.console import Console
        from rich.prompt import Prompt
        
        console = Console()
        console.print("[bold cyan]Database Manager[/bold cyan]")
        console.print("[1] Migracion")
        console.print("[2] Seeder")
        console.print("[1] Migracion")
        console.print("[2] Seeder")
        console.print("[3] Migracion + Seeder")
        console.print("[4] Inicializar Base de Datos (Create Tables + Stamp)")
        
        choice = Prompt.ask("Selecciona una opcion", choices=["1", "2", "3", "4"], default="3")
        
        if choice == "1":
            migrate_cmd()
        elif choice == "2":
            seed_cmd(name="all")
        elif choice == "3":
            db_all(ctx)
        elif choice == "4":
            init_db_cmd()

@app.command("all")
def db_all(ctx: typer.Context):
    """Run migrations and seeders together"""
    print_header("Running Database Setup (Migrate + Seed)")
    if run_migrations():
        print_success("Migrations applied.")
        run_all_seeders()
        print_success("Seeding completed.")
    else:
        print_error("Migrations failed. Aborting seeding.")
        raise typer.Exit(code=1)

@app.command("migrate")
def migrate_cmd():
    """Apply pending migrations"""
    print_header("Applying Migrations")
    if run_migrations():
        print_success("Done.")
    else:
        print_error("Failed.")
        raise typer.Exit(code=1)

@app.command("rollback")
def rollback_cmd():
    """Rollback the last migration"""
    print_header("Rolling Back")
    if rollback_migration():
        print_success("Done.")
    else:
        print_error("Failed.")

@app.command("reset")
def reset_cmd():
    """Reset database (Rollback all + Migrate)"""
    print_header("Resetting Database")
    if reset_database():
        print_success("Database reset successfully.")
    else:
        print_error("Reset failed.")

@app.command("status")
def status_cmd():
    """Show migration status"""
    print_header("Migration Status")
    show_current()

@app.command("history")
def history_cmd():
    """Show migration history"""
    print_header("Migration History")
@app.command("history")
def history_cmd():
    """Show migration history"""
    print_header("Migration History")
    show_history()

@app.command("init-db")
def init_db_cmd():
    """Initialize database (Create tables + Stamp Head). Use this if DB is empty/broken."""
    print_header("Initializing Database")
    if create_database():
        print_success("Database initialized.")
    else:
        print_error("Initialization failed.")

# --- Seeder Subgroup ---
# We can either make it a subcommand or just helper commands "seed:all", "seed:run"
# For simplicity in this structure: "seed" command

@app.command("seed")
def seed_cmd(name: str = typer.Argument("all", help="Name of seeder to run (users, servers, versions, bitacora) or 'all'")):
    """Run database seeders"""
    print_header(f"Running Seeder: {name}")
    
    if name == "all":
        run_all_seeders()
    else:
        # Simple mapping wrapper since run_specific_seeder prints its own stuff, 
        # but dev/database.py imports from database.seeder which uses print()
        # We might see double prints but that's okay for now.
        run_specific_seeder(name)
