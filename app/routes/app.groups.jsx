import prisma from './../db.server';
import { json } from '@remix-run/node';
import { useLoaderData, useFetcher } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { Page, Card, TextField, Button, ResourceList, ResourceItem, Text, Tabs, Modal, Checkbox, Layout } from '@shopify/polaris';
import SelectFreeGift from './app.select-free-gifts';

export async function loader() {
  const groups = await prisma.metafieldGroup.findMany();
  return json(groups);
}

export async function action({ request }) {
  const formData = await request.formData();
  const name = formData.get('name');
  const deleteId = formData.get('deleteId');
  const groupId = formData.get('groupId');
  const selectedMetafields = formData.get('metafields');

  // Handle group deletion
  if (deleteId) {
    await prisma.metafieldGroup.delete({
      where: { id: deleteId },
    });
    return json({ success: true, deletedId: deleteId });
  }

  // Handle new group creation
  if (name) {
    const newGroup = await prisma.metafieldGroup.create({
      data: { name, metafields: JSON.stringify([]) },
    });
    return json(newGroup);
  }

  // Handle updating metafields for the group
  if (groupId && selectedMetafields) {
    const parsedMetafields = JSON.parse(selectedMetafields);
    await prisma.metafieldGroup.update({
      where: { id: groupId },
      data: { metafields: JSON.stringify(parsedMetafields) },
    });
    return json({ success: true });
  }

  return json({ error: "Name, deleteId or groupId is required" }, { status: 400 });
}

export default function Groups() {
  const initialGroups = useLoaderData();//get the loader data
  const fetcher = useFetcher();
  const [metafieldGroups, setMetafieldGroups] = useState(initialGroups);
  const [groupName, setGroupName] = useState('');
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [metafieldDefinitions, setMetafieldDefinitions] = useState([]);
  const [selectedMetafields, setSelectedMetafields] = useState([[]]);
  const [tempSelectedMetafields, setTempSelectedMetafields] = useState([]);


  const handleGroupNameChange = (value) => setGroupName(value);

  useEffect(() => {
    if (fetcher.data && fetcher.data.name && fetcher.data.id) {
      setMetafieldGroups((prevGroups) => [
        ...prevGroups,
        fetcher.data
      ]);
    }

    if (fetcher.data && fetcher.data.deletedId) {
      setMetafieldGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== fetcher.data.deletedId)
      );
    }
  }, [fetcher.data]);//will be called after action submit

  const handleAddGroup = (event) => {
    event.preventDefault();
    fetcher.submit({ name: groupName }, { method: 'post' });
    setGroupName('');
  };

  const handleDeleteGroup = (id) => {
    fetcher.submit({ deleteId: id.toString() }, { method: 'post' });
  };

  const tabs = metafieldGroups.map((group) => ({
    id: group.id,
    content: group.name,
  }));

  const handleTabChange = (index) => {
    setActiveTabIndex(index);
  };

  // We need to use the groupId
  const handleAssignMetaFields = async (groupId) => {
    const response = await fetch("shopify:admin/api/graphql.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query {
            metafieldDefinitions(first: 100, ownerType: PRODUCT) {
              edges {
                node {
                  id
                  namespace
                  key
                  type {
                    valueType
                    name
                  }
                }
              }
            }
          }
        `,
      }),
    });

    const data = await response.json();
    console.log(data.data.metafieldDefinitions.edges);
    const definitions = data.data.metafieldDefinitions.edges.map(edge => ({
      id: edge.node.id,
      key: edge.node.key,
      namespace: edge.node.namespace,
      type: edge.node.type
    }));

    setMetafieldDefinitions(definitions);

    setTempSelectedMetafields(selectedMetafields[activeTabIndex] || []);

    setModalOpen(true);
  };


  // const handleCheckboxChange = (id) => {
  //   setSelectedMetafields((prev) => {
  //     // Create a copy of the previous state
  //     const updated = [...prev];

  //     // Ensure the array for the current tab exists
  //     if (!updated[activeTabIndex]) {
  //       updated[activeTabIndex] = [];
  //     }

  //     // Toggle the checkbox selection for the current tab
  //     updated[activeTabIndex] = updated[activeTabIndex].includes(id)
  //       ? updated[activeTabIndex].filter((item) => item !== id)
  //       : [...updated[activeTabIndex], id];
  //     console.log("Updated selectedMetafields:", updated);

  //     return updated;
  //   });
  // };

  const handleCheckboxChange = (id) => {
    setTempSelectedMetafields((prev) => {
      const updated = [...prev];

      if (updated.includes(id)) {
        return updated.filter((item) => item !== id);
      } else {
        return [...updated, id];
      }
    });
  };



  // const handleAssign = () => {
  //   const metafieldData = selectedMetafields[activeTabIndex].map((id) => {
  //     // Find the definition corresponding to the selected metafield ID
  //     const definition = metafieldDefinitions.find((def) => def.id === id);
  //     return {
  //       id, // Metafield ID
  //       namespace: definition?.namespace || "", // Namespace from the definition
  //       key: definition?.key || "", // Key from the definition
  //       type: {
  //         valueType: definition?.type?.valueType || "", // Value type from the definition
  //         name: definition?.type?.name
  //       },
  //     };
  //   });


  //   // Submit the selected metafields to be saved
  //   fetcher.submit(
  //     {
  //       metafields: JSON.stringify(metafieldData || []),
  //       groupId: metafieldGroups[activeTabIndex].id,
  //     },
  //     { method: 'post' }
  //   );

  //   setModalOpen(false);
  // };



  const handleAssign = () => {
    setSelectedMetafields((prev) => {
      const updated = [...prev];
      updated[activeTabIndex] = tempSelectedMetafields;
      return updated;
    });

    fetcher.submit(
      {
        metafields: JSON.stringify(tempSelectedMetafields),
        groupId: metafieldGroups[activeTabIndex].id,
      },
      { method: 'post' }
    );


    setModalOpen(false);
    setTempSelectedMetafields([]); // Reset temporary selections
  };

  console.log(setSelectedMetafields);

  // const handleModalClose = () => {
  //   setModalOpen(false);
  // };

  const handleModalClose = () => {
    setModalOpen(false);
    setTempSelectedMetafields([]); // Reset temporary selections
  };



  return (
    <Page title="Metafield Group Manager">
      <Card sectioned>
        <form onSubmit={handleAddGroup}>
          <TextField
            label="New Group Name"
            value={groupName}
            onChange={handleGroupNameChange}
            placeholder="Enter group name, e.g., Post Purchase"
            name="name"
          />
          <Button submit primary disabled={!groupName}>
            Add Group
          </Button>
        </form>
      </Card>

      <Card sectioned title="Defined Metafield Groups">
        <Tabs
          tabs={tabs}
          selected={activeTabIndex}
          onSelect={handleTabChange}
        >
          {metafieldGroups.map((group, index) => (
            <div key={group.id}>
              {activeTabIndex === index && (
                <div>
                  {/* Container for the buttons at the top */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <Button onClick={() => handleAssignMetaFields(group.id)}>
                        Assign Meta Fields
                      </Button>
                      <Button destructive onClick={() => handleDeleteGroup(group.id)} style={{ marginLeft: '8px' }}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {/* Full width product panel */}
                  <SelectFreeGift groupId={group.id} />
                </div>
              )}
            </div>
          ))}
        </Tabs>
      </Card>

      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title="Assign Metafields"
        primaryAction={{
          content: 'Assign',
          onAction: handleAssign,
        }}
      >
        <Modal.Section>
          <Card sectioned>
            <Text variant="headingMd" as="h2">Assign Metafields</Text>
            <Layout>
              {metafieldDefinitions.map((definition) => (
                <Layout.Section key={definition.id} oneHalf>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>

                    {/* <Checkbox
                      label={definition.key}
                      checked={selectedMetafields[activeTabIndex]?.includes(definition.id)}
                      onChange={() => handleCheckboxChange(definition.id)}
                    /> */}


                    <Checkbox
                      label={definition.key}
                      checked={tempSelectedMetafields.includes(definition.id)}
                      onChange={() => handleCheckboxChange(definition.id)}
                    />


                    <Text variant="bodySm" style={{ marginLeft: '8px' }}>{`Namespace: ${definition.namespace}`}</Text>
                    <Text variant="bodySm" style={{ marginLeft: '8px' }}>{`Type: ${definition.type}`}</Text>
                  </div>
                </Layout.Section>
              ))}
            </Layout>
          </Card>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
