/**
 * Service to interact with the server-side Gemini API
 */
export async function optimizeRoute(stops: {address: string, lat?: number, lng?: number}[], vehicleInfo?: string) {
  const prompt = `
    Analyze the following logistics route with ${stops.length} stops.
    Stops: ${JSON.stringify(stops.map((s, i) => ({ id: i, address: s.address })))}
    ${vehicleInfo ? `Vehicle Info: ${vehicleInfo}` : ''}
    
    Task: Propose the most efficient sequence of stops to minimize distance and time, considering typical urban logic (grouping nearby points).
    
    Return ONLY a JSON array of the stop indices in the new recommended order.
    Example: [0, 2, 1, 3]
  `;

  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error('AI request failed');
    
    const data = await response.json();
    const cleanText = data.text.replace(/```json/g, '').replace(/```/g, '').trim();
    const optimizedOrder = JSON.parse(cleanText);
    
    if (Array.isArray(optimizedOrder)) {
      return optimizedOrder;
    }
    return null;
  } catch (error) {
    console.error("AI Optimization Error:", error);
    return null;
  }
}
