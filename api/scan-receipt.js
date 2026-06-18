export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Scanner not configured." }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid request." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const { imageBase64, mediaType, mode } = body;
  if (!imageBase64 || !mediaType) {
    return new Response(JSON.stringify({ error: "Missing image data." }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const prompts = {
    fuel: `You are a fuel receipt data extractor for a trucking bookkeeping app. Extract all data from this fuel receipt image and return ONLY a JSON object with these fields (use null for missing):
{
  "date": "YYYY-MM-DD or null",
  "stationName": "string or null",
  "stationAddress": "string or null",
  "stationCity": "string or null",
  "stationState": "2-letter state code or null",
  "fuelTypes": [{ "type": "Diesel|DEF|Reefer Fuel|CNG|Propane|Other", "gallons": number or null, "pricePerGallon": number or null, "total": number or null }],
  "taxPaid": true or false,
  "totalAmount": number or null,
  "paymentMethod": "Cash|Credit Card|Fuel Card|Fleet Card|EFS|Comcheck or null",
  "receiptNumber": "string or null",
  "unitNumber": "string or null",
  "notes": "any other relevant info or null"
}
Return ONLY the JSON, no other text.`,

    expense: `You are a receipt data extractor for a trucking bookkeeping app. Extract all data from this receipt/invoice image and return ONLY a JSON object (use null for missing):
{
  "date": "YYYY-MM-DD or null",
  "amount": number or null,
  "vendor": "merchant or payee name or null",
  "description": "brief description of what was purchased or null",
  "category": "best guess: maintenance|insurance|fuel|meals|lodging|tolls|scales|permits|supplies|communications|office|legal|other or null",
  "paymentMethod": "Cash|Credit Card|Check|ACH or null",
  "receiptNumber": "invoice or receipt number or null",
  "notes": "any other relevant info or null"
}
Return ONLY the JSON, no other text.`,

    income: `You are a settlement/remittance data extractor for a trucking bookkeeping app. Extract all data from this document and return ONLY a JSON object (use null for missing):
{
  "date": "YYYY-MM-DD or null",
  "amount": number or null,
  "payer": "company or broker name paying or null",
  "description": "brief description or null",
  "loadNumber": "load or reference number or null",
  "category": "best guess: linehaul|fuel_surcharge|detention|tonu|bonus|reimbursement|other or null",
  "notes": "any other relevant info or null"
}
Return ONLY the JSON, no other text.`,
  };

  const prompt = prompts[mode] || prompts.expense;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.map(c => c.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify({ ok: true, data: parsed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Could not read receipt. Please fill in manually." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}
