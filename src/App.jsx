import { useEffect, useState } from "react"
import mqtt from "mqtt"

const broker = "wss://1f987687489a42f296be8b2579cd71f5.s1.eu.hivemq.cloud:8884/mqtt"

const options = {
  username: "ESP32",
  password: "Laundry123",
  reconnectPeriod: 1000
}

function App() {

  const [client, setClient] = useState(null)
  const [status, setStatus] = useState("Disconnected")

  useEffect(() => {

    const mqttClient = mqtt.connect(broker, options)

    mqttClient.on("connect", () => {
      console.log("MQTT Connected")
      setStatus("Connected")
    })

    mqttClient.on("error", (err) => {
      console.log("Connection error: ", err)
      mqttClient.end()
    })

    setClient(mqttClient)

    return () => {
      if (mqttClient) mqttClient.end()
    }

  }, [])

  const startMachine = (id) => {
    if (client) {
      client.publish(`laundry/machine${id}`, "ON")
      console.log("Start machine", id)
    }
  }

  const stopMachine = (id) => {
    if (client) {
      client.publish(`laundry/machine${id}`, "OFF")
      console.log("Stop machine", id)
    }
  }

  const machines = [1,2,3,4]

  return (
    <div style={{padding:"40px", fontFamily:"Arial"}}>

      <h1>Smart Laundry Control</h1>

      <h3>MQTT Status: {status}</h3>

      {machines.map((id)=>(
        <div key={id} style={{
          border:"1px solid #ccc",
          padding:"20px",
          marginBottom:"10px",
          borderRadius:"10px"
        }}>

          <h2>Machine {id}</h2>

          <button
            onClick={()=>startMachine(id)}
            style={{
              background:"green",
              color:"white",
              padding:"10px",
              marginRight:"10px",
              border:"none",
              borderRadius:"5px"
            }}
          >
            Start
          </button>

          <button
            onClick={()=>stopMachine(id)}
            style={{
              background:"red",
              color:"white",
              padding:"10px",
              border:"none",
              borderRadius:"5px"
            }}
          >
            Stop
          </button>

        </div>
      ))}

    </div>
  )
}

export default App