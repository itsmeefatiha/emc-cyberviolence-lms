from djoser.serializers import UserCreateSerializer as BaseUserCreateSerializer, UserSerializer as BaseUserSerializer
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Utilisateur


class CustomUserCreateSerializer(BaseUserCreateSerializer):
    """Serializer used by Djoser for Registration."""
    class Meta(BaseUserCreateSerializer.Meta):
        model = Utilisateur
        fields = (
            'id', 'username', 'email', 'password', 
            'first_name', 'last_name', 'telephone', 'role', 
            'specialite', 'profil_professionnel'
        )


class CustomUserSerializer(BaseUserSerializer):
    """Serializer used by Djoser for /api/auth/users/me/."""
    class Meta(BaseUserSerializer.Meta):
        model = Utilisateur
        fields = (
            'id', 'username', 'email', 'first_name', 
            'last_name', 'telephone', 'role', 'specialite', 
            'profil_professionnel', 'created_at', 'updated_at', 'last_login'
        )
        read_only_fields = ('id', 'role', 'created_at', 'updated_at', 'last_login')


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Embeds role & profile into the JWT payload for immediate access in React."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['profil_professionnel'] = user.profil_professionnel
        token['full_name'] = f"{user.first_name} {user.last_name}"
        return token