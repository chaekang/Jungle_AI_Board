import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import type { AuthenticatedUser } from "src/common/interfaces/authenticated-user.interface";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";

// Controller: 어떤 URL이 어떤 함수를 부르는지 정하는 곳
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: AuthenticatedUser) {
        return this.authService.getMe(user);
    }
}