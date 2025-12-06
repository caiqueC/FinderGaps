import nodemailer from 'nodemailer';

function getHtmlTemplate(topic) {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Space+Grotesk:wght@300;400;600&display=swap');
    body { font-family: 'Space Grotesk', Helvetica, Arial, sans-serif; background-color: #f5f5f7; margin: 0; padding: 0; color: #333; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background-color: #000; color: #fff; padding: 40px 20px; text-align: center; }
    .header h1 { font-family: 'Playfair Display', serif; margin: 0; font-size: 28px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; }
    .content { padding: 40px 30px; line-height: 1.6; }
    .topic-box { background: #f9f9f9; border-left: 4px solid #000; padding: 15px; margin: 20px 0; font-style: italic; color: #555; }
    .footer { background-color: #f5f5f7; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eaeaea; }
    .btn { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: 600; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Plan Genie</h1>
    </div>
    <div class="content">
      <p>Olá,</p>
      <p>Seu estudo de mercado está pronto. O <strong>Plan Genie</strong> analisou concorrentes e referências para entregar insights estratégicos sobre sua ideia.</p>
      
      <div class="topic-box">
        "${topic}"
      </div>
      
      <p>O relatório completo em PDF encontra-se em anexo a este email via FinderGaps CLI.</p>
      
      <p><em>Equipe Plan Genie</em></p>
    </div>
    <div class="footer">
      Plan Genie Framework • Market Compass
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendReportEmail(to, pdfPath, topic, smtpConfig) {
    if (!to || !pdfPath) return;

    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port == 465, // true for 465, false for other ports
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
    });

    const mailOptions = {
        from: `"Plan Genie" <${smtpConfig.user}>`,
        to: to,
        subject: `Seu Relatório de Mercado: ${topic.substring(0, 50)}...`,
        text: `Seu relatório sobre "${topic}" está pronto e anexado.`,
        html: getHtmlTemplate(topic),
        attachments: [
            {
                filename: `PlanGenie_Report.pdf`,
                path: pdfPath,
            },
        ],
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('[EMAIL] Relatório enviado com sucesso! ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('[ERRO] Falha no envio de email:', error.message);
        return false;
    }
}
