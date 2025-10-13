# Helper script to set up Digital Ocean deployment

set -e

echo "🚀 Athletic Director Dashboard - Deployment Setup"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ doctl is not installed${NC}"
    echo "Install it from: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

echo -e "${GREEN}✅ doctl is installed${NC}"

# Check if user is authenticated
if ! doctl auth list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Digital Ocean${NC}"
    echo "Run: doctl auth init"
    exit 1
fi

echo -e "${GREEN}✅ Authenticated with Digital Ocean${NC}"
echo ""

# Generate NEXTAUTH_SECRET if not exists
if [ ! -f .env.production ]; then
    echo "📝 Creating .env.production file..."
    cp .env.production.example .env.production
    
    # Generate random secret
    SECRET=$(openssl rand -base64 32)
    
    # Replace in .env.production
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-32-character-random-string-here/$SECRET/" .env.production
    else
        # Linux
        sed -i "s/your-32-character-random-string-here/$SECRET/" .env.production
    fi
    
    echo -e "${GREEN}✅ Created .env.production with generated NEXTAUTH_SECRET${NC}"
    echo -e "${YELLOW}⚠️  Please edit .env.production and fill in other values${NC}"
    echo ""
fi

# Function to create database
create_database() {
    echo "📦 Creating PostgreSQL Database..."
    echo "Name: athletic-db"
    echo "Region (nyc1, nyc3, sfo2, sfo3, etc.): "
    read -r REGION
    
    doctl databases create athletic-db \
        --engine pg \
        --version 15 \
        --region "$REGION" \
        --size db-s-1vcpu-1gb \
        --num-nodes 1
    
    echo -e "${GREEN}✅ Database created!${NC}"
    echo "Wait 2-5 minutes for it to be ready, then get connection string:"
    echo "doctl databases connection athletic-db"
}

# Function to create app
create_app() {
    echo "🚀 Creating App Platform Application..."
    
    if [ ! -f .do/app.yaml ]; then
        echo -e "${RED}❌ .do/app.yaml not found${NC}"
        echo "Create it first using the App Platform Configuration template"
        exit 1
    fi
    
    # Update app.yaml with GitHub repo
    echo "GitHub username: "
    read -r GH_USER
    echo "Repository name: "
    read -r GH_REPO
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/YOUR_GITHUB_USERNAME/$GH_USER/" .do/app.yaml
        sed -i '' "s/YOUR_REPO_NAME/$GH_REPO/" .do/app.yaml
    else
        sed -i "s/YOUR_GITHUB_USERNAME/$GH_USER/" .do/app.yaml
        sed -i "s/YOUR_REPO_NAME/$GH_REPO/" .do/app.yaml
    fi
    
    # Create app
    doctl apps create --spec .do/app.yaml
    
    echo -e "${GREEN}✅ App created!${NC}"
    echo "Go to: https://cloud.digitalocean.com/apps"
}

# Function to get info
get_info() {
    echo "📊 Your Digital Ocean Resources:"
    echo ""
    
    echo "=== Databases ==="
    doctl databases list
    echo ""
    
    echo "=== Apps ==="
    doctl apps list
    echo ""
    
    echo "=== Connection Info ==="
    echo "Get database connection string:"
    echo "doctl databases connection <database-id>"
    echo ""
    echo "Get app details:"
    echo "doctl apps get <app-id>"
}

# Main menu
echo "What would you like to do?"
echo "1) Create PostgreSQL Database"
echo "2) Create App Platform Application"
echo "3) View Existing Resources"
echo "4) Exit"
echo ""
echo -n "Enter choice [1-4]: "
read -r choice

case $choice in
    1)
        create_database
        ;;
    2)
        create_app
        ;;
    3)
        get_info
        ;;
    4)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "=================================================="
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in Digital Ocean"
echo "2. Push to GitHub to trigger deployment"
echo "3. Run database migrations"
echo ""
echo "See the full deployment guide for details."