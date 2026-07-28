import emailjs from '@emailjs/browser';

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export function itemsListHtml(items: { item: string; inventoryCode: string }[]) {
  return `<ul>${items.map((i) => `<li>${i.item} — Serial: ${i.inventoryCode}</li>`).join('')}</ul>`;
}

export function sendTemplateEmail(
  templateId: string,
  params: { to_email: string; to_name: string; items_list: string },
) {
  return emailjs.send(serviceId, templateId, params, { publicKey });
}
