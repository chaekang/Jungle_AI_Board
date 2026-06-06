import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "src/users/users.service";
import { RegisterDto } from "./dto/register.dto";
import * as bcrypt from "bcrypt";
import { LoginDto } from "./dto/login.dto";
import { JwtPaylaod } from "./interfaces/jwt-payload.interface";
import { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";

@Injectable()
// 회원가입, 로그인, 사용자 조회 판단 및 처리
export class AuthService {
    // constructor: 실제로 실행하기 전에 필요한 것을 받아서 준비함
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService
    ) {}

    // 회원가입
    async register(registerDto: RegisterDto) {
        const existingUser = await this.usersService.findByEmail(registerDto.email);

        if (existingUser) {
            throw new ConflictException('Email already exists');
        }

        const passwordHash = await bcrypt.hash(registerDto.password, 10);

        const user = await this.usersService.create({
            email: registerDto.email,
            passwordHash,
            nickname: registerDto.nickname
        });

        return this.usersService.toPublicUser(user);
    }

    // 로그인
    async login(loginDto: LoginDto) {
        const user = await this.usersService.findByEmail(loginDto.email);
        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash)
        if (!passwordMatches) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const payload: JwtPaylaod = {
            sub: user.id.toString(),
            email: user.email
        };

        // JWT 토큰 발급
        const accessToken = await this.jwtService.signAsync(payload);

        return {
            accessToken,
            user: this.usersService.toPublicUser(user)
        }
    }

    // 현재 로그인 사용자 조회
    async getMe(currentUser: AuthenticatedUser) {
        // 토큰 안에 있던 사용자 id로 DB에서 사용자 다시 찾기
        const user = await this.usersService.findById(BigInt(currentUser.id));
        if (!user) {
            throw new UnauthorizedException("User no longer exists");
        }

        return this.usersService.toPublicUser(user);
    }
}