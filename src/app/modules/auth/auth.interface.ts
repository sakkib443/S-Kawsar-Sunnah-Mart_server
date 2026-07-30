export interface IJwtPayload {
    userId: string;
    email: string;
    role: 'superadmin' | 'admin' | 'user';
    iat?: number;
    exp?: number;
}

export interface ITokens {
    accessToken: string;
    refreshToken: string;
}

export interface IAuthResponse {
    user: {
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
        avatar: string;
    };
    tokens: ITokens;
}
