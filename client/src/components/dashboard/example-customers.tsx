import { Card, CardContent } from "@/components/ui/card";

// Example customer data 
const customersData = [
  {
    id: 1,
    title: "PR Agencies",
    description: "Streamline client communications by quickly generating on-brand responses to industry news.",
    imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    imageAlt: "PR agency team meeting",
  },
  {
    id: 2,
    title: "In-house Comms Teams",
    description: "Maintain consistent voice across all communications while responding quickly to market changes.",
    imageUrl: "https://images.unsplash.com/photo-1553877522-43269d4ea984?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    imageAlt: "In-house communications team",
  },
  {
    id: 3,
    title: "Media Relations",
    description: "Craft journalist pitches that are relevant and timely based on breaking news in your industry.",
    imageUrl: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
    imageAlt: "Media relations professional",
  },
];

export default function ExampleCustomers() {
  return (
    <div className="mb-12">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">How PR Teams Use PRomptly</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {customersData.map((customer) => (
          <Card key={customer.id} className="overflow-hidden hover:translate-y-[-2px] transition-all duration-200">
            <div className="h-44 w-full overflow-hidden">
              <img 
                src={customer.imageUrl} 
                alt={customer.imageAlt} 
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{customer.title}</h3>
              <p className="text-base text-gray-700">{customer.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
