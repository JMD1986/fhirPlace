// tools/ehrTools.js
const EHR_TOOLS = [
  {
    name: "get_patient_resource",
    description: `Fetch a specific FHIR resource for the current patient from the EHR system. 
                  Use this when the user asks about their health data such as immunizations, 
                  conditions, medications, allergies, lab results, etc.`,
    input_schema: {
      type: "object",
      properties: {
        resource_type: {
          type: "string",
          enum: [
            "Immunization",
            "Condition",
            "MedicationRequest",
            "AllergyIntolerance",
            "Observation",
            "Procedure",
            "DiagnosticReport",
            "Encounter",
            "CarePlan",
          ],
          description: "The FHIR resource type to fetch",
        },
        reason: {
          type: "string",
          description:
            "Brief explanation of why this resource is being requested",
        },
      },
      required: ["resource_type", "reason"],
    },
  },
];

export default EHR_TOOLS;
