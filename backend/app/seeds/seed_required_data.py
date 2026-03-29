"""Seed required production data."""

from app.seeds.seed_base_data import seed_cities


def main():
    seed_cities()


if __name__ == "__main__":
    main()
