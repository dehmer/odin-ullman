export const fields = [
  {
    id: "field:5dd8f977-087f-477b-86fa-5246b4cd697a",
    label: "Name",
    property: "Name",
    type: "text"
  },
  {
    id: "field:7884019e-1a39-47ea-a49e-6ec4409aae09",
    label: "Echelon",
    property: ["sidc", 11],
    type: "select",
    options: [
      ["N/A", "-"],
      ["Team/Crew", "A"],
      ["Squad", "B"],
      ["Section", "C"],
      ["Platoon", "D"],
      ["Company", "E"],
      ["Battalion", "F"],
      ["Regiment/Group", "G"],
      ["Brigade", "H"],
      ["Division", "I"],
      ["Corps", "J"],
      ["Army", "K"],
      ["Front", "L"],
      ["Region", "M"],
      ["Command", "N"]
    ]
  },
  {
    id: "field:996da414-0d3e-47fa-b152-ba5897c9c05a",
    property: ["sidc", 1],
    type: "identity"
  },
  {
    id: "field:7f4f9c8b-d6d9-4c84-b190-415b5cb8063f",
    property: ["sidc", 3],
    // Present/Anticipated WITHOUT operational condition
    type: "status"
  },
  {
    id: "field:2913e3bd-9533-4c2d-8270-0e0e29f88d1d",
    property: ["sidc", 3],
    // Present/Anticipated WITH operational condition
    type: "opcon"
  },
  {
    id: "field:738a5729-3fc8-4c3a-9686-2aa1964a8831",
    label: "Additional Information",
    property: "h",
    type: "text"
  },
  {
    id: "field:c96a5722-a5c9-4412-868e-94b731713b8a",
    label: "Unique Designation",
    property: "t",
    type: "text"
  },
  {
    id: "field:1d75ae52-7ea0-48a5-b461-335839def1b4",
    label: "Unique Designation (Left)",
    property: "t",
    type: "text"
  },
  {
    id: "field:5a0902df-7dd1-4fea-8e0f-f54312bc5e2e",
    label: "Unique Designation (Right)",
    property: "t1",
    type: "text"
  },
  {
    id: "field:112bd4d2-ada5-4b4b-94f3-95bd22418e3a",
    label: "Higher Formation",
    property: "m",
    type: "text"
  },
  {
    id: "field:fb7bc60f-d403-456e-9bbf-4036a7883d22",
    label: "Date-Time",
    property: "w",
    type: "text"
  },
  {
    id: "field:93141668-18cf-4ad9-ac92-ae68b8ef4fd3",
    label: "Effective (from)",
    property: "w",
    type: "text"
  },
  {
    id: "field:6c8c45d8-5ce6-4341-8e69-3012a65b02c8",
    label: "Effective (to)",
    property: "w1",
    type: "text"
  },
  {
    id: "field:81aedcbd-9154-4d0d-8d32-9aec44b22f28",
    label: "Staff Comment",
    property: "g",
    type: "text"
  },
  {
    id: "field:c18271b2-eb60-42bd-9b07-83f9dc1f0442",
    label: "Modifiers",
    property: ['sidc', 10],
    type: "modifiers"
  },
  {
    id: "field:8d5ce7eb-d533-482f-a210-66abc9afa921",
    property: 'f',
    type: "assignment" // reinforced/reduced
  },
  {
    id: "field:255017bc-b18a-4f37-99cb-c8c326792560",
    label: 'Speed',
    property: 'z',
    type: "text"
  },
  {
    id: "field:59221d55-7157-45ad-9456-1dee3e344064",
    label: 'Direction',
    property: 'q',
    type: "text"
  },
  {
    id: "field:78464e9f-e557-4d25-af7f-674b44473e15",
    label: 'Special C2 HQ',
    property: 'aa',
    type: "text"
  },
  {
    id: "field:339c6c21-7f4b-4494-b585-a3f16f4beb60",
    label: 'Quantity',
    property: 'c',
    type: "text"
  },
  {
    id: "field:2a20becd-7683-415d-be66-ba59bba3c681",
    label: 'Mobility',
    property: ['sidc', 10, 11],
    type: "mobility"
  },
  {
    id: "field:a9ab7cb2-0ce8-4781-986c-5a001b693432",
    label: 'Type',
    property: 'v',
    type: "text"
  },

]

export const selectors = [
  {
    id: "form:b6387ad4-9f38-43c4-b116-577ab458e3e6",
    selector: "scope ~= unit",
    fields: [
      "field:5dd8f977-087f-477b-86fa-5246b4cd697a", // Name
      "field:c96a5722-a5c9-4412-868e-94b731713b8a", // Unique Designation
      "field:112bd4d2-ada5-4b4b-94f3-95bd22418e3a", // Higher Formation
      "field:78464e9f-e557-4d25-af7f-674b44473e15", // Special C2 HQ
      "field:7884019e-1a39-47ea-a49e-6ec4409aae09", // Echelon
      "field:c18271b2-eb60-42bd-9b07-83f9dc1f0442", // Modifiers: HQ, TF, F/D
      "field:996da414-0d3e-47fa-b152-ba5897c9c05a", // (Standard) Identity/Hostility
      "field:7f4f9c8b-d6d9-4c84-b190-415b5cb8063f", // Status (without Operational Condition)
      "field:8d5ce7eb-d533-482f-a210-66abc9afa921", // Assignment (reinforced/reduced)
      "field:255017bc-b18a-4f37-99cb-c8c326792560", // Speed
      "field:59221d55-7157-45ad-9456-1dee3e344064", // Direction
      "field:81aedcbd-9154-4d0d-8d32-9aec44b22f28", // Staff Comment
      "field:738a5729-3fc8-4c3a-9686-2aa1964a8831", // Additional Information
      "field:fb7bc60f-d403-456e-9bbf-4036a7883d22", // DTG (w)
    ]
  },
  {
    id: "form:b1f85f06-1dd6-40ff-87f7-524cbb7c7450",
    selector: "scope ~= equipment",
    fields: [
      "field:5dd8f977-087f-477b-86fa-5246b4cd697a", // Name
      "field:c96a5722-a5c9-4412-868e-94b731713b8a", // Unique Designation
      "field:339c6c21-7f4b-4494-b585-a3f16f4beb60", // Quantity
      "field:a9ab7cb2-0ce8-4781-986c-5a001b693432", // Type
      "field:996da414-0d3e-47fa-b152-ba5897c9c05a", // (Standard) Identity//Hostility
      "field:2913e3bd-9533-4c2d-8270-0e0e29f88d1d", // Status (with Operational Condition)
      "field:c18271b2-eb60-42bd-9b07-83f9dc1f0442", // Modifiers: HQ, TF, F/D
      "field:2a20becd-7683-415d-be66-ba59bba3c681", // Mobility Indicator
      "field:255017bc-b18a-4f37-99cb-c8c326792560", // Speed
      "field:59221d55-7157-45ad-9456-1dee3e344064", // Direction
      "field:81aedcbd-9154-4d0d-8d32-9aec44b22f28", // Staff Comment
      "field:738a5729-3fc8-4c3a-9686-2aa1964a8831", // Additional Information
      "field:fb7bc60f-d403-456e-9bbf-4036a7883d22", // DTG (w)
    ]
  },
  {
    id: "form:3a88c0ca-c4a2-4c33-a108-0c749c5d6dd2",
    selector: "hierarchy ~= boundaries",
    fields: [
      "field:5dd8f977-087f-477b-86fa-5246b4cd697a", // Name
      "field:1d75ae52-7ea0-48a5-b461-335839def1b4",
      "field:5a0902df-7dd1-4fea-8e0f-f54312bc5e2e",
      "field:93141668-18cf-4ad9-ac92-ae68b8ef4fd3",
      "field:6c8c45d8-5ce6-4341-8e69-3012a65b02c8"
    ]
  },
  {
    id: "form:d9d05aaa-5bc9-4032-b95a-fa224ca754b4",
    selector: [
      "scope ~= installation",
      "hierarchy ~= installation"
    ],
    fields: [
      "field:5dd8f977-087f-477b-86fa-5246b4cd697a", // Name
      "field:c96a5722-a5c9-4412-868e-94b731713b8a", // Unique Designation
      "field:996da414-0d3e-47fa-b152-ba5897c9c05a", // (Standard) Identity//Hostility
      "field:2913e3bd-9533-4c2d-8270-0e0e29f88d1d", // Status (with Operational Condition)
      "field:c18271b2-eb60-42bd-9b07-83f9dc1f0442", // Modifiers: HQ, TF, F/D
      "field:81aedcbd-9154-4d0d-8d32-9aec44b22f28", // Staff Comment
      "field:738a5729-3fc8-4c3a-9686-2aa1964a8831", // Additional Information
      "field:fb7bc60f-d403-456e-9bbf-4036a7883d22", // DTG (w)
    ]
  }
]
