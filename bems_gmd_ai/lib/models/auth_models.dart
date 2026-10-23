class AuthUser {
  final String id;
  final String email;
  final String fullName;
  final String role;
  final String? organizationId;

  AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.organizationId,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['workEmail']?.toString() ?? json['email']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? json['name']?.toString() ?? 'Executive',
      role: json['role']?.toString() ?? 'GMD',
      organizationId: json['organizationId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'fullName': fullName,
      'role': role,
      'organizationId': organizationId,
    };
  }
}
