"""Charge basique de l’API apprenant (login JWT, catalogue, profil).

Prérequis : Django démarré et `python manage.py seed_e2e` déjà exécuté.

  locust -f nft/locustfile.py --host http://127.0.0.1:8000
  locust -f nft/locustfile.py --headless -u 8 -r 4 -t 30s --host http://127.0.0.1:8000
"""

import os

from locust import HttpUser, between, task

LEARNER_EMAIL = os.getenv('LOCUST_EMAIL', 'e2e.apprenant@example.com')
LEARNER_PASSWORD = os.getenv('LOCUST_PASSWORD', 'E2ePass123!')


class LearnerApiUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        self.token = None
        response = self.client.post(
            '/api/auth/jwt/create/',
            json={'email': LEARNER_EMAIL, 'password': LEARNER_PASSWORD},
            name='POST /api/auth/jwt/create/',
        )
        if response.ok:
            self.token = response.json().get('access')

    def _auth_headers(self):
        if not self.token:
            return {}
        return {'Authorization': f'Bearer {self.token}'}

    @task(3)
    def list_published_courses(self):
        self.client.get(
            '/api/v1/courses/parcours/',
            headers=self._auth_headers(),
            name='GET /api/v1/courses/parcours/',
        )

    @task(2)
    def load_profile(self):
        if not self.token:
            return
        self.client.get(
            '/api/auth/users/me/',
            headers=self._auth_headers(),
            name='GET /api/auth/users/me/',
        )

    @task(1)
    def open_api_docs(self):
        self.client.get('/api/docs/', name='GET /api/docs/')
