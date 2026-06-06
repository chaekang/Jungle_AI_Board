import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";
import { JwtPaylaod } from "./interfaces/jwt-payload.interface";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            // 요청 헤더에 `Bearer <token>` 형태로 보내면, 그 중에서 토큰값만 뽑아서 검증함
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),   
            ignoreExpiration: false,    // 만료된 토큰은 실패
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET')   // `.env`의 `JWT_SECRET`으로 토큰 서명 검증
        });
    }

    // 토큰이 유효하면 이 함수가 실행됨. 이 리턴값이 `request.user`가 됨
    async validate(payload: JwtPaylaod): Promise<AuthenticatedUser> {  // 바로 값을 주는게 아니라 비동기로 나중에 줌
        return {
            id: payload.sub,
            email: payload.email
        }
    }
}