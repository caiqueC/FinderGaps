import nodemailer from 'nodemailer';

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
        from: `"FinderGaps Report" <${smtpConfig.user}>`,
        to: to,
        subject: `Seu Relatório de Mercado: ${topic}`,
        text: `Olá,\n\nSegue em anexo o relatório de análise de mercado gerado para o tema: "${topic}".\n\nAtt,\nEquipe FinderGaps`,
        attachments: [
            {
                filename: `Relatorio-${topic.replace(/[^a-z0-9]/gi, '_').substring(0, 20)}.pdf`,
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
