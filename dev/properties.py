import typer
import os
from rich.console import Console
from rich.table import Table

app = typer.Typer(help="Manage server.properties configuration")
console = Console()

DEFAULT_PROPERTIES_FILE = "server.properties"

def load_properties(file_path: str):
    """Parses a server.properties file into a dictionary."""
    props = {}
    if not os.path.exists(file_path):
        return props
    
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                props[key.strip()] = value.strip()
    return props

def save_properties(file_path: str, props: dict):
    """Saves a dictionary of properties back to the file."""
    lines = []
    # Read original lines to preserve comments if possible, but for now simple overwrite
    # To do it properly, we'd read, modify in place. 
    # specific implementation: Read all lines, if key found replace, else append.
    
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            lines = f.readlines()
    
    new_lines = []
    keys_written = set()
    
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in props:
                new_lines.append(f"{key}={props[key]}\n")
                keys_written.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    # Append new keys
    for key, value in props.items():
        if key not in keys_written:
            new_lines.append(f"{key}={value}\n")
            
    with open(file_path, "w") as f:
        f.writelines(new_lines)

@app.command("list")
def list_properties(file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """List all properties in the file."""
    if not os.path.exists(file):
        console.print(f"[red]File {file} not found.[/red]")
        return

    props = load_properties(file)
    table = Table(title=f"Properties in {file}")
    table.add_column("Key", style="cyan")
    table.add_column("Value", style="green")
    
    for k, v in props.items():
        table.add_row(k, v)
        
    console.print(table)

@app.command("get")
def get_property(key: str, file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Get a specific property value."""
    props = load_properties(file)
    if key in props:
        console.print(f"[bold]{key}[/bold] = [green]{props[key]}[/green]")
    else:
        console.print(f"[yellow]Property '{key}' not found.[/yellow]")

@app.command("set")
def set_property(key: str, value: str, file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Set a property value."""
    props = {key: value}
    save_properties(file, props)
    console.print(f"[green]Set {key}={value} in {file}[/green]")

@app.command("set-port")
def set_port(port: int, file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Shortcut to set server-port."""
    set_property("server-port", str(port), file)

@app.command("bind-local")
def bind_local(file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Bind server to 127.0.0.1 (Localhost only)."""
    set_property("server-ip", "127.0.0.1", file)

@app.command("bind-public")
def bind_public(file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Bind server to 0.0.0.0 (Publicly accessible)."""
    set_property("server-ip", "0.0.0.0", file)

@app.command("bind")
def bind(ip: str, file: str = typer.Option(DEFAULT_PROPERTIES_FILE, help="Path to server.properties")):
    """Bind server to a specific IP."""
    set_property("server-ip", ip, file)
