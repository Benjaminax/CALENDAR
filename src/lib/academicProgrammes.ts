export const ACADEMIC_PROGRAMMES = [
  {
    code: "AC",
    catalogueId: "bba-accounting",
    name: "BBA Accounting",
    department: "Business Administration and Entrepreneurship",
  },
  {
    code: "BF",
    catalogueId: "bba-banking-finance",
    name: "BBA Banking and Finance",
    department: "Business Administration and Entrepreneurship",
  },
  {
    code: "EP",
    catalogueId: "bba-entrepreneurship",
    name: "BBA Entrepreneurship",
    department: "Business Administration and Entrepreneurship",
  },
  {
    code: "HR",
    catalogueId: "bba-human-resource-management",
    name: "BBA Human Resource Management",
    department: "Business Administration and Entrepreneurship",
  },
  {
    code: "MK",
    catalogueId: "bba-marketing",
    name: "BBA Marketing",
    department: "Business Administration and Entrepreneurship",
  },
  {
    code: "AP",
    catalogueId: "ba-advertising-public-relations",
    name: "BA Advertising and Public Relations",
    department: "Communication Arts",
  },
  {
    code: "JM",
    catalogueId: "ba-journalism-mass-communication",
    name: "BA Journalism and Mass Communication",
    department: "Communication Arts",
  },
  {
    code: "CE",
    catalogueId: "bsc-computer-engineering",
    name: "BSc Computer Engineering",
    department: "Electrical, Electronics & Computer Engineering",
  },
  {
    code: "EE",
    catalogueId: "bsc-electrical-electronics-engineering",
    name: "BSc Electrical and Electronics Engineering",
    department: "Electrical, Electronics & Computer Engineering",
  },
  {
    code: "EC",
    catalogueId: "bsc-electronics-communications-engineering",
    name: "BSc Electronics and Communications Engineering",
    department: "Electrical, Electronics & Computer Engineering",
  },
  {
    code: "ME",
    catalogueId: "bsc-mechanical-engineering",
    name: "BSc Mechanical Engineering",
    department: "Mechanical, Industrial & Systems Engineering",
  },
  {
    code: "RE",
    catalogueId: "bsc-robotics-engineering",
    name: "BSc Robotics Engineering",
    department: "Mechanical, Industrial & Systems Engineering",
  },
  {
    code: "IE",
    catalogueId: "bsc-industrial-systems-engineering",
    name: "BSc Industrial and Systems Engineering",
    department: "Mechanical, Industrial & Systems Engineering",
  },
  {
    code: "BE",
    catalogueId: "bsc-biomedical-engineering",
    name: "BSc Biomedical Engineering",
    department: "Biomedical Engineering",
  },
  {
    code: "CS",
    catalogueId: "bsc-computer-science",
    name: "BSc Computer Science",
    department: "Computational Sciences",
  },
  {
    code: "AI",
    catalogueId: "bsc-artificial-intelligence",
    name: "BSc Artificial Intelligence",
    department: "Computational Sciences",
  },
  {
    code: "IT",
    catalogueId: "bsc-information-technology",
    name: "BSc Information Technology",
    department: "Informatics",
  },
] as const;

export type Programme = (typeof ACADEMIC_PROGRAMMES)[number]["code"];
