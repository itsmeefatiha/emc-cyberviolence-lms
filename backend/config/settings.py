"""
Django settings for config project.
"""

import os
import sys
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------------------------------------------------------
# DETECT TESTING ENVIRONMENT & LOAD DOTENV
# -----------------------------------------------------------------------------
# Détection si la commande lancée est un test (pytest, manage.py test, ou TESTING=True)
IS_TESTING = (
    os.getenv('TESTING', 'False') == 'True' 
    or 'test' in sys.argv 
    or 'pytest' in sys.modules
)

if IS_TESTING:
    env_test_file = BASE_DIR / '.env.test'
    if env_test_file.exists():
        load_dotenv(env_test_file, override=True, encoding='utf-8')
    else:
        load_dotenv(BASE_DIR / '.env', override=True, encoding='utf-8')
else:
    # override=True : une variable Windows vide ne doit pas masquer la clé du .env
    load_dotenv(BASE_DIR / '.env', override=True, encoding='utf-8')


def _env_first(*names: str) -> str:
    """Lit une valeur depuis os.environ puis le fichier .env (trim + sans guillemets)."""
    from dotenv import dotenv_values

    file_vals = dotenv_values(BASE_DIR / '.env', encoding='utf-8') or {}
    for name in names:
        raw = os.getenv(name)
        if raw is None or str(raw).strip() == '':
            raw = file_vals.get(name)
        if raw is None:
            continue
        value = str(raw).strip().strip('"').strip("'")
        if value:
            return value
    return ''


# Add 'apps' folder to Python path so Django can locate internal apps cleanly
sys.path.insert(0, os.path.join(BASE_DIR, 'apps'))


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'django-insecure-0z7si)oqcs@%-7+ii3-b2bi4^3188art+1uuscuj$=y*bee3c%')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True') == 'True'

# Application definition

INSTALLED_APPS = [
    # Default Django Apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-Party Apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'djoser',
    'drf_spectacular',

    # Local Apps
    'apps.users',
    'apps.courses.apps.CoursesConfig',
    'apps.quizzes.apps.QuizzesConfig',
    'apps.progression',
    'apps.notifications.apps.NotificationsConfig',
    'apps.live_sessions.apps.LiveSessionsConfig',
    'apps.chat.apps.ChatConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# -----------------------------------------------------------------------------
# DATABASE CONFIGURATION (PostgreSQL)
# -----------------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('POSTGRES_DB', 'emc_lms_db'),
        'USER': os.getenv('POSTGRES_USER', 'postgres'),
        'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'postgres'),
        'HOST': os.getenv('POSTGRES_HOST', '127.0.0.1'),
        'PORT': os.getenv('POSTGRES_PORT', '5432'),
        'TEST': {
            # Nom de la BDD créée/supprimée à la volée pendant le test
            'NAME': f"test_{os.getenv('POSTGRES_DB', 'emc_lms_db')}",
        }
    }
}


# -----------------------------------------------------------------------------
# AUTHENTICATION & CUSTOM USER MODEL
# -----------------------------------------------------------------------------
AUTH_USER_MODEL = 'users.Utilisateur'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# -----------------------------------------------------------------------------
# EMAIL CONFIGURATION (SMTP vs In-Memory pour les tests)
# -----------------------------------------------------------------------------
if IS_TESTING:
    # En mode test : intercepte les emails en mémoire sans utiliser SMTP
    EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
else:
    EMAIL_BACKEND = os.getenv(
        'EMAIL_BACKEND',
        'django.core.mail.backends.smtp.EmailBackend',
    )
    EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')

DEFAULT_FROM_EMAIL = f"EMC E-Formation <{os.getenv('EMAIL_HOST_USER', 'noreply@emc.ma')}>"

# -----------------------------------------------------------------------------
# OPTIMISATION DES TESTS (Hasher ultra-rapide pour accélérer les tests)
# -----------------------------------------------------------------------------
if IS_TESTING:
    # Accélère la création des utilisateurs de test (skip PBKDF2 lourd)
    PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]

# -----------------------------------------------------------------------------
# DJOSER & SIMPLE JWT CONFIGURATION
# -----------------------------------------------------------------------------
DJOSER = {
    'LOGIN_FIELD': 'email',
    'USER_CREATE_PASSWORD_RETYPE': True,
    'EMAIL_FRONTEND_DOMAIN': os.getenv('EMAIL_FRONTEND_DOMAIN', 'localhost:5173'),
    'EMAIL_FRONTEND_SITE_NAME': 'EMC E-Formation',
    'EMAIL_FRONTEND_PROTOCOL': os.getenv('EMAIL_FRONTEND_PROTOCOL', 'http'),
    'SEND_ACTIVATION_EMAIL': True,
    'ACTIVATION_URL': 'activate/{uid}/{token}',
    'PASSWORD_RESET_CONFIRM_URL': 'password/reset/confirm/{uid}/{token}',
    'PASSWORD_RESET_CONFIRM_RETYPE': True,
    'SEND_CONFIRMATION_EMAIL': True,
    'TOKEN_MODEL': None,
    'SERIALIZERS': {
        'user_create': 'apps.users.serializers.CustomUserCreateSerializer',
        'user_create_password_retype': 'apps.users.serializers.CustomUserCreatePasswordRetypeSerializer',
        'user': 'apps.users.serializers.CustomUserSerializer',
        'current_user': 'apps.users.serializers.CustomUserSerializer',
    },
}

REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'EMC Cyberconfiance LMS API',
    'DESCRIPTION': 'API backend for Espace Maroc Cyberconfiance LMS platform.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
    },
}

SIMPLE_JWT = {
    'TOKEN_OBTAIN_SERIALIZER': 'apps.users.serializers.CustomTokenObtainPairSerializer',
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# -----------------------------------------------------------------------------
# CORS & STATIC CONFIGURATION
# -----------------------------------------------------------------------------
def _csv_env(name, default):
    raw = os.getenv(name, '')
    if not str(raw).strip():
        return default
    return [item.strip() for item in str(raw).split(',') if item.strip()]


ALLOWED_HOSTS = _csv_env('ALLOWED_HOSTS', ['*'])

CORS_ALLOWED_ORIGINS = _csv_env(
    'CORS_ALLOWED_ORIGINS',
    [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
    ],
)
CSRF_TRUSTED_ORIGINS = _csv_env('CSRF_TRUSTED_ORIGINS', CORS_ALLOWED_ORIGINS)
CORS_ALLOW_CREDENTIALS = True
X_FRAME_OPTIONS = 'SAMEORIGIN'
USE_X_FORWARDED_HOST = os.getenv('USE_X_FORWARDED_HOST', 'False') == 'True'

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Visioconférence native WebRTC (STUN publics — TURN optionnel en prod NAT strict)
LIVE_SESSION_ICE_SERVERS = [
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'stun:stun1.l.google.com:19302'},
]
