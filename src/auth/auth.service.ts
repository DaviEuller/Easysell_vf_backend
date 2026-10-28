import { Injectable, UnauthorizedException, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return user;
  }

  async sendPasswordResetCode(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);

    // Always return the same response so this endpoint cannot reveal registered emails.
    if (!user) return { message: 'Se o e-mail estiver cadastrado, você receberá um código.' };

    const publicKey = this.configService.get<string>('EMAILJS_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('EMAILJS_PRIVATE_KEY');
    const serviceId = this.configService.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.configService.get<string>('EMAILJS_TEMPLATE_ID');
    if (!publicKey || !privateKey || !serviceId || !templateId) {
      throw new ServiceUnavailableException('EmailJS não configurado.');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.usersService.savePasswordResetCode(
      normalizedEmail,
      code,
      new Date(Date.now() + 10 * 60 * 1000),
    );

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: {
          to_email: normalizedEmail,
          email: normalizedEmail,
          user_name: user.name,
          recovery_code: code,
          expires_in_minutes: 10,
        },
      }),
    });
    if (!response.ok) {
      const providerText = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `O EmailJS recusou o envio: ${providerText || `HTTP ${response.status}`}`,
      );
    }
    return { message: 'Se o e-mail estiver cadastrado, você receberá um código.' };
  }

  async resetPassword(email: string, code: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const updated = await this.usersService.resetPassword(normalizedEmail, code, password);
    if (!updated) throw new BadRequestException('Código inválido ou expirado.');
    return { message: 'Senha redefinida com sucesso.' };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const empresaId = user.company?.toString();

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      senha: user.passwordHash,
      role: user.role,
      empresaId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      sub: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      empresaId,
      equipeMember: user.equipeMember?.toString(),
    };
  }
}
