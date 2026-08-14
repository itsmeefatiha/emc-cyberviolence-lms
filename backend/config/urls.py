from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', RedirectView.as_view(url='/api/docs/', permanent=False)),
    
    # Authentication & Users
    path('api/auth/', include('djoser.urls')),
    path('api/auth/', include('djoser.urls.jwt')),

    # Courses
    path('api/v1/courses/', include('apps.courses.urls')),

    # Quizzes & certification
    path('api/v1/quizzes/', include('apps.quizzes.urls')),

    # Live sessions (visioconférence)
    path('api/v1/live/', include('apps.live_sessions.urls')),

    # Chat apprenant ↔ formateur
    path('api/v1/chat/', include('apps.chat.urls')),

    # Progression
    path('api/v1/', include('apps.progression.urls')),

    # Notifications
    path('api/v1/', include('apps.notifications.urls')),
    
    # API Documentation (Swagger & Redoc)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)