from config.settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

MIGRATION_MODULES = {
    'core': None,
    'authentication': None,
    'clinical': None,
    'pharmacy_inventory': None,
    'billing_finance': None,
    'operations_hr': None,
    'voice_translation': None,
}
