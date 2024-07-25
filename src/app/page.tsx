"use client"

import { useState, FormEvent } from 'react';
import { EXAMPLE_PROMPT_FRONTPAGE } from './api/json/example';


export default function Home() {

  const [input, setInput] = useState<string>('');
  const [response, setResponse] = useState<string>('');


  const handleSubmit = async (e: FormEvent) => {
    
    e.preventDefault(); // Prevents default form submission behavior, which would typically reload the page

    const res = await fetch('/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: input
    });

    const data = await res.json();  // Wait for the response to be converted from JSON format to a JavaScript object.

    const formattedData = JSON.stringify(data, null, 4) // Beautify it

    setResponse(formattedData);
  };


  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-start', padding: '20px' }}>
      <div>
        <h1>POST request body</h1>

        <form onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={15}
            cols={100}
            maxLength={1000}
          />
          <br />
          <button type="submit">Send</button>
        </form>

        {/* Show response if there's any. Put it inside pre tags so that it appears beautified instead of in one line */}
        <div>
          <h2>Response:</h2>
          {response && (
            <pre style={{ backgroundColor:'#f4f4f4', padding:'10px', borderRadius:'5px' }}>
              {response}
            </pre>
          )}
        </div>

      </div>


      <div style={{ marginLeft: '20px' }}>
        <h1>Example body</h1>
        <pre style={{ backgroundColor:'#f4f4f4', padding:'10px', borderRadius:'5px' }}>
          {EXAMPLE_PROMPT_FRONTPAGE}
        </pre>
      </div>

    </div>
  );
}
