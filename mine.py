import typer
import sys
import os
import importlib.util
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

# Initialize Typer and Console
app = typer.Typer(help="Minecraft Server Manager CLI Tool")
console = Console()

# --- Dynamic Loader ---
def load_commands():
    """
    Dynamically load commands from the 'dev' directory.
    """
    dev_dir = os.path.join(os.path.dirname(__file__), "dev")
    if not os.path.exists(dev_dir):
        os.makedirs(dev_dir)
        return

    for filename in os.listdir(dev_dir):
        if filename.endswith(".py") and filename != "__init__.py" and filename != "utils.py":
            module_name = filename[:-3]
            file_path = os.path.join(dev_dir, filename)
            
            try:
                spec = importlib.util.spec_from_file_location(f"dev.{module_name}", file_path)
                if spec and spec.loader:
                    module = importlib.util.module_from_spec(spec)
                    sys.modules[f"dev.{module_name}"] = module
                    spec.loader.exec_module(module)
                    
                    if hasattr(module, "app"):
                        # Add the module's Typer app as a sub-command group
                        app.add_typer(module.app, name=module_name)
            except Exception as e:
                console.print(f"[red]Failed to load module {module_name}: {e}[/red]")

# Load commands immediately
load_commands()

# --- Interactive Menu ---

@app.callback(invoke_without_command=True)
def main_interactive(ctx: typer.Context):
    """
    Main entry point. Launches interactive menu if no command is provided.
    """
    if ctx.invoked_subcommand is None:
        show_menu()

def show_menu():
    while True:
        console.clear()
        
        # Header
        console.print(Panel.fit(
            "[bold white]Minecraft Server Manager CLI[/bold white]\n[cyan]Manage your servers, database, and system.[/cyan]",
            title="Welcome",
            border_style="blue"
        ))

        # Options Table
        table = Table(show_header=True, header_style="bold magenta", expand=True)
        table.add_column("No.", style="dim", width=4, justify="center")
        table.add_column("Category", style="cyan", width=12)
        table.add_column("Action", style="white")
        table.add_column("Description", style="dim")

        table.add_row("1", "Server", "Run (Dev)", "Start development server")
        table.add_row("2", "Database", "Manager", "Interactive database menu")
        table.add_row("3", "Database", "Initialize", "Fix/Reset DB (Create Tables)")
        table.add_row("4", "Database", "Create User", "Interactive admin creation")
        table.add_row("5", "System", "Info", "View CPU/RAM usage")
        table.add_row("6", "Maintenance", "Clean Logs", "Delete old logs")
        table.add_row("7", "Backup", "Create Backup", "Zip critical files")
        table.add_row("8", "Config", "Properties", "Edit server.properties")
        table.add_row("9", "Network", "Config", "Manage Host & Port")
        table.add_row("0", "Exit", "Quit", "Close the CLI")
        
        console.print(table)
        console.print("\n")

        choice = Prompt.ask("Select an option", choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], default="1")

        cmd_prefix = f"{sys.executable} mine.py"

        if choice == "1":
            os.system(f"{cmd_prefix} server run")
        elif choice == "2":
            os.system(f"{cmd_prefix} database")
        elif choice == "3":
            os.system(f"{cmd_prefix} database init-db")
        elif choice == "4":
            console.print("\n[bold cyan]Create New User[/bold cyan]")
            username = Prompt.ask("Username")
            password = Prompt.ask("Password", password=True)
            
            # Import explicitly here to avoid import loops or early initialization issues if any
            from dev.utils import create_user_service, print_success, print_error
            
            success, message = create_user_service(username, password)
            if success:
                print_success(message)
            else:
                print_error(message)
        elif choice == "5":
            os.system(f"{cmd_prefix} maintenance info")
        elif choice == "6":
            days = Prompt.ask("Delete logs older than X days?", default="7")
            os.system(f"{cmd_prefix} maintenance clean-logs --days {days}")
        elif choice == "7":
            os.system(f"{cmd_prefix} backup create")
        elif choice == "8":
            # List servers to choose from
            servers_dir = os.path.join(os.getcwd(), "servers")
            if os.path.exists(servers_dir):
                servers = [d for d in os.listdir(servers_dir) if os.path.isdir(os.path.join(servers_dir, d))]
                if not servers:
                    console.print("[yellow]No servers found in 'servers/' directory.[/yellow]")
                    input("Press Enter...")
                    continue
                
                console.print("\n[bold cyan]Available Servers:[/bold cyan]")
                for idx, server in enumerate(servers):
                    console.print(f"{idx + 1}. {server}")
                
                srv_choice = Prompt.ask("Select a server", choices=[str(i+1) for i in range(len(servers))], default="1")
                selected_server = servers[int(srv_choice) - 1]
                prop_file = os.path.join(servers_dir, selected_server, "server.properties")
                
                action = Prompt.ask("Action", choices=["list", "set", "bind-local", "bind-public"], default="list")
                
                if action == "list":
                    os.system(f"{cmd_prefix} properties list --file \"{prop_file}\"")
                elif action == "set":
                    key = Prompt.ask("Key")
                    val = Prompt.ask("Value")
                    os.system(f"{cmd_prefix} properties set {key} {val} --file \"{prop_file}\"")
                elif action == "bind-local":
                    os.system(f"{cmd_prefix} properties bind-local --file \"{prop_file}\"")
                elif action == "bind-public":
                    os.system(f"{cmd_prefix} properties bind-public --file \"{prop_file}\"")
            else:
                console.print("[red]'servers/' directory not found.[/red]")
                
        elif choice == "9":
            os.system(f"{cmd_prefix} network configure")
        elif choice == "0":
            console.print("[bold]Goodbye![/bold]")
            sys.exit(0)
            
        if choice != "0" and choice != "9": # 9 handles its own pause or menu loop usually
             # Actually network configure does recursive menu, so upon return we might want to clear or just continue
             # But the current implementation of network configure loops until exit.
             # So we don't strictly need a pause after it returns, but main loop handlescls anyway.
             pass
             
        if choice != "9" and choice != "0": # Don't pause for 9 as it has its own UI flow
            input("\nPress Enter to continue...")

if __name__ == "__main__":
    app()
