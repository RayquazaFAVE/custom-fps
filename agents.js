(function () {
  const AGENT_KEY = "customfps_agent_v1";

  const agents = [
    {
      id: "jett",
      name: "JETT",
      role: "DUELIST",
      color: "#7dd3fc",
      description: "Agile duelist who uses wind to reposition, block sightlines, and strike with lethal throwing knives.",
      passive: {
        name: "Drift",
        description: "Hold Jump while falling to glide safely from high ledges."
      },
      abilities: {
        c: { key: "C", name: "Cloudburst", maxCharges: 2, startCharges: 2, description: "Throws a projectile that expands into a brief vision-blocking cloud on impact." },
        q: { key: "Q", name: "Updraft", maxCharges: 1, startCharges: 1, description: "Propels Jett high into the air." },
        e: { key: "E", name: "Tailwind", maxCharges: 1, startCharges: 1, killsToRecharge: 2, description: "Activate to prime wind, press E again to dash rapidly in your movement direction." }
      },
      ultimate: {
        key: "X",
        name: "Blade Spin",
        ultCost: 8,
        description: "Equips 5 accurate throwing knives; getting a kill restores all knives."
      }
    }
  ];

  function getAgent(id) {
    return agents.find(a => a.id === id) || agents[0];
  }

  function getSelectedAgentId() {
    try {
      return localStorage.getItem(AGENT_KEY) || "jett";
    } catch {
      return "jett";
    }
  }

  function setSelectedAgentId(id) {
    try {
      localStorage.setItem(AGENT_KEY, getAgent(id).id);
    } catch {}
  }

  window.CustomFPSAgents = {
    agents,
    getAgent,
    getSelectedAgentId,
    setSelectedAgentId
  };
})();
