#!/bin/bash

# Minecraft Server Manager - Linux/Mac Installer

echo "Detection of Operating System..."

OS="$(uname -s)"
DISTRO=""

if [ "$OS" = "Linux" ]; then
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
    fi
elif [ "$OS" = "Darwin" ]; then
    DISTRO="macos"
fi

echo "Detected: $OS ($DISTRO)"

# Function to install dependencies based on distro
install_deps() {
    echo "Installing System Dependencies..."
    case $DISTRO in
        ubuntu|debian|kali|linuxmint)
            sudo apt-get update
            sudo apt-get install -y python3-venv python3-pip openjdk-17-jre
            ;;
        fedora)
            sudo dnf install -y python3 pip java-17-openjdk
            ;;
        arch|manjaro)
            sudo pacman -Syu --noconfirm python python-pip jre17-openjdk
            ;;
        centos|rhel)
            sudo yum install -y python3 pip java-17-openjdk
            ;;
        macos)
            if ! command -v brew &> /dev/null; then
                echo "Homebrew not found. Please install Homebrew first."
                exit 1
            fi
            brew install python openjdk@17
            ;;
        *)
            echo "Unsupported distribution: $DISTRO. Please install Python 3 and Java 17 manually."
            ;;
    esac
}

# Check for Java
if ! command -v java &> /dev/null; then
    install_deps
else
    echo "Java is already installed."
    # We might still need python3-venv on some minimal installs
    if [ "$DISTRO" = "ubuntu" ] || [ "$DISTRO" = "debian" ]; then
        dpkg -s python3-venv &> /dev/null || sudo apt-get install -y python3-venv
    fi
fi

# Create Venv
if [ ! -d "venv" ]; then
    echo "Creating Python Virtual Environment..."
    python3 -m venv venv
else
    echo "Virtual Environment already exists."
fi

# Activate and Install
source venv/bin/activate
echo "Installing Python Dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Run Setup
echo "Running Setup Configuration..."
python setup.py

echo ""
echo "Installation Complete!"
echo "You can now run the server using: ./venv/bin/python run.py"
