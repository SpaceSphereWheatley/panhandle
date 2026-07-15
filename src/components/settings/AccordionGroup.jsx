import { createContext, useContext, useState } from "react";

const AccordionGroupContext = createContext(null);

// Scopes a set of AccordionRows so opening one closes any other that's
// currently open in the same group — one per top-level Settings section
// (ProfileIsland, HomeIsland, AdminIsland), not global, so unrelated
// sections don't fight over which subsection stays open.
export function AccordionGroup({ children }) {
  const [openId, setOpenId] = useState(null);
  return (
    <AccordionGroupContext.Provider value={{ openId, setOpenId }}>
      {children}
    </AccordionGroupContext.Provider>
  );
}

export function useAccordionGroup() {
  return useContext(AccordionGroupContext);
}
