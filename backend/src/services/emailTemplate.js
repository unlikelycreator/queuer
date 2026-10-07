const { escapeHtml } = require('../utils/sanitize');

/**
 * Wraps email content in a simple, client-safe branded layout (inline styles only, so it
 * renders consistently in Gmail/Outlook). `body` is trusted HTML — callers must escape
 * any user-provided text before passing it in.
 */
function renderEmail({ brand = 'ZoopDesk', heading, body, cta }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10231a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f4;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe8df">
          <tr><td style="background:linear-gradient(135deg,#065f46,#10b981);padding:20px 28px;color:#ffffff;font-weight:700;font-size:16px;letter-spacing:-0.01em">${escapeHtml(brand)}</td></tr>
          <tr><td style="padding:28px">
            ${heading ? `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0b1f16">${escapeHtml(heading)}</h1>` : ''}
            <div style="font-size:14px;line-height:1.65;color:#2b4136">${body}</div>
            ${
              cta
                ? `<p style="margin:24px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px">${escapeHtml(cta.label)}</a></p>`
                : ''
            }
          </td></tr>
          <tr><td style="padding:16px 28px;border-top:1px solid #e6efe9;font-size:12px;color:#6b8577">Sent by ${escapeHtml(brand)} via ZoopDesk</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

module.exports = { renderEmail };
