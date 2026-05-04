import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';

const PDF_TIMEOUT_MS = 30_000;

/**
 * Service de rendu HTML → PDF via Puppeteer.
 *
 * Garde une instance Chromium partagée et réutilisable pour
 * éviter le coût de spawn à chaque génération.
 */
@Injectable()
export class PdfRendererService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;

  async onModuleInit(): Promise<void> {
    this.logger.log('🔧 Initialisation du moteur de rendu PDF…');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    this.logger.log('✅ Moteur PDF prêt');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.log('🛑 Moteur PDF arrêté');
    }
  }

  /**
   * Rend un buffer PDF à partir d'un HTML complet.
   * @throws si le moteur n'est pas initialisé ou si la génération échoue.
   */
  async render(html: string): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Moteur PDF non initialisé');
    }
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: PDF_TIMEOUT_MS,
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        timeout: PDF_TIMEOUT_MS,
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }
}
