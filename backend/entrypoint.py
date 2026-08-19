import os
import time

import django
import psycopg2
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')


def wait_for_postgres():
    for _ in range(30):
        try:
            psycopg2.connect(
                dbname=os.environ.get('POSTGRES_DB', 'emc_lms_db'),
                user=os.environ.get('POSTGRES_USER', 'postgres'),
                password=os.environ.get('POSTGRES_PASSWORD', 'postgres'),
                host=os.environ.get('POSTGRES_HOST', 'db'),
                port=os.environ.get('POSTGRES_PORT', '5432'),
            ).close()
            return
        except Exception:
            time.sleep(1)
    raise SystemExit('PostgreSQL is unavailable')


def ensure_superuser():
    from django.contrib.auth import get_user_model

    email = os.getenv('DJANGO_SUPERUSER_EMAIL')
    password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
    if not email or not password:
        return

    User = get_user_model()
    if User.objects.filter(email=email).exists():
        return

    User.objects.create_superuser(
        username=os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin'),
        email=email,
        password=password,
        first_name=os.getenv('DJANGO_SUPERUSER_FIRST_NAME', 'Admin'),
        last_name=os.getenv('DJANGO_SUPERUSER_LAST_NAME', 'EMC'),
        role='ADMIN',
        is_active=True,
    )


def main():
    wait_for_postgres()
    django.setup()
    call_command('migrate', interactive=False, verbosity=1)
    call_command('collectstatic', interactive=False, verbosity=0)
    ensure_superuser()

    os.execvp(
        'gunicorn',
        [
            'gunicorn',
            'config.wsgi:application',
            '--bind',
            '0.0.0.0:8000',
            '--workers',
            '3',
            '--timeout',
            '120',
        ],
    )


if __name__ == '__main__':
    main()
