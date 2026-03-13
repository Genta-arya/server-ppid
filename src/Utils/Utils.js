export const formatPhone = (phone) => {
  let cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  }

  if (cleaned.startsWith("62")) {
    return cleaned;
  }

  return null;
};

