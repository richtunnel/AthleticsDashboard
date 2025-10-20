#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

case "$1" in
    "build")
        print_status "Building Docker images..."
        docker-compose build
        ;;
    
    "up")
        print_status "Starting services in production mode..."
        docker-compose up -d
        print_status "Services started! Application available at http://localhost:3000"
        print_status "Adminer (DB manager) available at http://localhost:8080"
        ;;
    
    "down")
        print_status "Stopping services..."
        docker-compose down
        ;;
    
    "dev")
        print_status "Starting development environment..."
        docker-compose -f docker-compose.dev.yml up
        ;;
    
    "dev-build")
        print_status "Building and starting development environment..."
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    
    "dev-down")
        print_status "Stopping development environment..."
        docker-compose -f docker-compose.dev.yml down
        ;;
    
    "logs")
        print_status "Showing logs..."
        docker-compose logs -f ${2:-app}
        ;;
    
    "prisma-studio")
        print_status "Opening Prisma Studio..."
        docker-compose exec app npx prisma studio
        ;;
    
    "migrate")
        print_status "Running database migrations..."
        docker-compose exec app npx prisma migrate deploy
        ;;
    
    "migrate-dev")
        print_status "Creating new migration..."
        docker-compose exec app-dev npx prisma migrate dev --name ${2:-migration}
        ;;
    
    "seed")
        print_status "Seeding database..."
        docker-compose exec app npx prisma db seed
        ;;
    
    "reset-db")
        print_warning "This will delete all data in the database!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            docker-compose down -v
            docker-compose up -d postgres
            sleep 5
            docker-compose exec app npx prisma migrate deploy
            print_status "Database reset complete"
        fi
        ;;
    
    "shell")
        print_status "Opening shell in app container..."
        docker-compose exec app sh
        ;;
    
    "clean")
        print_warning "This will remove all containers and volumes!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            docker-compose down -v
            docker system prune -f
            print_status "Cleanup complete"
        fi
        ;;
    
    "status")
        print_status "Container status:"
        docker-compose ps
        ;;
    
    *)
        echo "Athletics Dashboard - Docker Management"
        echo "======================================="
        echo ""
        echo "Usage: ./docker-scripts.sh [command]"
        echo ""
        echo "Production Commands:"
        echo "  build          - Build Docker images"
        echo "  up             - Start services in production mode"
        echo "  down           - Stop services"
        echo "  logs [service] - Show logs (default: app)"
        echo "  status         - Show container status"
        echo ""
        echo "Development Commands:"
        echo "  dev            - Start development environment"
        echo "  dev-build      - Build and start development environment"
        echo "  dev-down       - Stop development environment"
        echo ""
        echo "Database Commands:"
        echo "  migrate        - Run database migrations"
        echo "  migrate-dev    - Create new migration (dev)"
        echo "  seed           - Seed database"
        echo "  prisma-studio  - Open Prisma Studio"
        echo "  reset-db       - Reset database (WARNING: deletes all data)"
        echo ""
        echo "Utility Commands:"
        echo "  shell          - Open shell in app container"
        echo "  clean          - Remove all containers and volumes"
        echo ""
        ;;
esac