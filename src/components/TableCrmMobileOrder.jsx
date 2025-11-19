import { useEffect, useState } from 'react';
import { AutoComplete, Form, Input, Button, Select, Modal, Table, InputNumber, message, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Search } = Input;

const API_BASE = 'https://app.tablecrm.com/api/v1';

const toOptions = (arr, valueKey = 'id', labelKey = 'name') =>
    Array.isArray(arr) ? arr.map(item => ({ value: item[valueKey], label: item[labelKey] })) : [];

export default function TableCrmMobileOrder() {
    const urlToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null;
    const [token, setToken] = useState(() => urlToken || localStorage.getItem('crm_token') || '');

    const [loading, setLoading] = useState(false);
    const [phone, setPhone] = useState('');
    const [customer, setCustomer] = useState(null);
    const [customersList, setCustomersList] = useState([]);

    const [phoneOptions, setPhoneOptions] = useState([]);
    const [organizationsOptions, setOrganizationsOptions] = useState([]);
    const [warehousesOptions, setWarehousesOptions] = useState([]);
    const [priceTypesOptions, setPriceTypesOptions] = useState([]);
    const [payboxesOptions, setPayboxesOptions] = useState([]);
    const [products, setProducts] = useState([]);

    const [selectedProducts, setSelectedProducts] = useState([]);
    const [productModal, setProductModal] = useState(false);
    const [search, setSearch] = useState('');

    const [form] = Form.useForm();

    const fetchJson = async (url, options = {}) => {
        const res = await fetch(url, options);
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch {
            throw new Error(`Не JSON ответ от ${url}:\n${text}`);
        }
    };

    // ----------------- Загрузка списков (с полными URL) -----------------
    const fetchLists = async () => {
        if (!token) return message.error('Введите токен');
        setLoading(true);
        try {
            const [orgRes, whRes, ptRes, pbRes, prodRes, custRes] = await Promise.all([
                fetchJson(`${API_BASE}/organizations/?token=${token}`),
                fetchJson(`${API_BASE}/warehouses/?token=${token}`),
                fetchJson(`${API_BASE}/price_types/?token=${token}`),
                fetchJson(`${API_BASE}/payboxes/?token=${token}`),
                fetchJson(`${API_BASE}/nomenclature/?token=${token}`),
                fetchJson(`${API_BASE}/contragents/?token=${token}`),
            ]);

            console.log(orgRes)

            setOrganizationsOptions(toOptions(orgRes.result, 'id', 'short_name'));
            setWarehousesOptions(toOptions(whRes.result, 'id', 'name'));
            setPriceTypesOptions(toOptions(ptRes.result, 'id', 'name'));
            setPayboxesOptions(toOptions(pbRes.result, 'id', 'name'));
            setProducts(
                Array.isArray(prodRes)
                    ? prodRes
                    : Array.isArray(prodRes.result)
                        ? prodRes.result
                        : []
            );
            const customers = Array.isArray(custRes)
                ? custRes
                : Array.isArray(custRes.result)
                    ? custRes.result
                    : [];
            setCustomersList(customers);

            setPhoneOptions(customers.map(c => ({
                value: c.phone || c.name,
                label: `${c.phone || ''} — ${c.name || ''}`,
                raw: c,
                key: c.id,
            })));

            message.success('Списки загружены');
        } catch (e) {
            console.error(e);
            message.error(e.message || 'Ошибка загрузки списков');
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Поиск локально -----------------
    const handlePhoneChange = val => {
        const digitsOnly = val.replace(/\D/g, '');
        setPhone(digitsOnly);

        // фильтруем локально
        setPhoneOptions(
            customersList
                .filter(c => (c.phone || '').replace(/\D/g, '').includes(digitsOnly))
                .map(c => ({
                    value: c.phone || c.name,
                    label: `${c.phone || ''} — ${c.name || ''}`,
                    raw: c,
                    key: c.id
                }))
        );
    };

    // ----------------- Добавление/удаление/обновление товаров -----------------
    const addProduct = p => {
        setSelectedProducts(prev => {
            const exists = prev.find(x => x.id === p.id);
            if (exists) return prev.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x);
            return [...prev, { ...p, qty: 1 }];
        });
    };

    const removeProduct = id => setSelectedProducts(prev => prev.filter(p => p.id !== id));

    // ----------------- Формирование payload -----------------
    const payload = values => ([{
        dated: Math.floor(Date.now() / 1000),
        operation: 'Заказ',
        tax_included: true,
        tax_active: true,
        goods: selectedProducts.map(p => ({
            price: p.price ?? 0,
            quantity: p.qty ?? 1,
            unit: p.unit ?? 0,
            discount: p.discount ?? 0,
            sum_discounted: ((p.price ?? 0) * (p.qty ?? 1) * (p.discount ?? 0)) / 100,
            nomenclature: p.id
        })),
        settings: { date_next_created: null },
        loyality_card_id: customer?.id || null,
        warehouse: values.warehouse,
        contragent: customer?.id || null,
        paybox: values.paybox || null,
        organization: values.organization,
        status: false,
        paid_rubles: values.paid_rubles || 0,
        paid_lt: values.paid_lt || 0,
        priority: values.priority || 0
    }]);

    // ----------------- Отправка формы (POST full URL) -----------------
    const submit = async (values, process, testOnly = false) => {
        if (!token) return message.error('Введите токен');

        const body = payload(values);

        console.log("=== PAYLOAD CHECK ===");
        console.log(JSON.stringify(body, null, 2));

        // Если режим проверки, не делаем fetch
        if (testOnly) {
            message.info('Payload проверен. Запрос не отправлен.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/docs_sales/?token=${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const text = await res.text();
            let json;
            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(`Неожиданный ответ при создании заказа:\n${text}`);
            }
            message.success('Заказ создан');

            if (process && json[0]?.id) {
                const patchRes = await fetch(`${API_BASE}/docs_sales/${json[0].id}/status?token=${token}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: true })
                });
                const patchText = await patchRes.text();
                try {
                    JSON.parse(patchText);
                    message.success('Заказ проведен');
                } catch {
                    throw new Error(`Неожиданный ответ при проведении заказа:\n${patchText}`);
                }
            }
        } catch (e) {
            console.error(e);
            message.error(e.message || 'Ошибка отправки');
        } finally {
            setLoading(false);
        }
    };

    // ----------------- Таблица товаров -----------------
    const updateProduct = (id, changes) => {
        setSelectedProducts(prev =>
            prev.map(p =>
                p.id === id ? { ...p, ...changes } : p
            )
        );
    };

    const productColumns = [
        {
            title: 'Название',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Цена',
            dataIndex: 'price',
            key: 'price',
            render: (_, record) => (
                <InputNumber
                    defaultValue={0}
                    className="expand-input"
                    size="small"
                    min={0}
                    value={record.price || 0}
                    onChange={(v) => updateProduct(record.id, { price: v })}
                />
            )
        },
        {
            title: 'Кол-во',
            dataIndex: 'qty',
            key: 'qty',
            render: (_, record) => (
                <InputNumber
                    defaultValue={1}
                    size="small"
                    min={1}
                    value={record.qty ?? 1}
                    onChange={(v) => updateProduct(record.id, { qty: v })}
                    style={{ width: 40 }}
                />
            )
        },
        {
            title: 'Скидка %',
            dataIndex: 'discount',
            key: 'discount',
            render: (_, record) => (
                <InputNumber
                    defaultValue={0}
                    size="small"
                    min={0}
                    max={100}
                    value={record.discount ?? 0}
                    onChange={(v) => updateProduct(record.id, { discount: v })}
                    style={{ width: 40}}
                />
            )
        },
        {
            title: 'Итого',
            key: 'total',
            render: (_, record) => {
                const price = record.price || 0;
                const qty = record.qty || 1;
                const discount = record.discount || 0;

                const base = price * qty;
                const total = base - (base * discount) / 100;

                return total.toFixed(2);
            }
        },
        {
            title: '',
            key: 'action',
            render: (_, record) => (
                <Button size="small" danger onClick={() => removeProduct(record.id)}>
                    <DeleteOutlined />
                </Button>
            )
        }
    ];

    const handleTokenChange = (value) => {
        setToken(value);
        localStorage.setItem('crm_token', value);
    };

    useEffect(() => {
        if (token) {
            fetchLists();
        }
    }, [token]);

    return (
        <div className="bg-white p-4 mt-4 mx-auto rounded-2xl shadow-md" style={{ maxWidth: '420px' }}>
            <Form layout="vertical" form={form}>
                <Form.Item label="Токен" style={{maxHeight: '55px'}}>
                    <Input value={token}
                           onChange={e => handleTokenChange(e.target.value)}
                           placeholder="Введите токен кассы"
                    />
                </Form.Item>

                <Button type="primary" className="mb-2" onClick={fetchLists} block loading={loading}>Продолжить</Button>
                <Form.Item label="Контрагент (поиск по номеру телефона)">
                    <AutoComplete
                        value={phone}
                        options={phoneOptions}
                        filterOption={(input, option) =>
                            option.value.replace(/\D/g, '').includes(input.replace(/\D/g, ''))
                        }
                        onChange={handlePhoneChange}
                        onSelect={(val, option) => {
                            if (option?.raw) {
                                setCustomer(option.raw);
                                setPhone(option.raw.phone || option.raw.name);
                                message.success(`Выбран клиент: ${option.raw.name}`);
                            }
                        }}
                        style={{ width: '100%' }}
                    >
                        <Input placeholder="Введите номер телефона" inputMode="numeric" pattern="[0-9]*" allowClear suffix={loading ? <Spin size="small" /> : null} />
                    </AutoComplete>
                    {customer && (
                        <div className="font-bold mt-2 -mb-2">
                            Выбран контрагент: {customer.contragent_name || customer.name || customer.id}
                        </div>
                    )}
                </Form.Item>

                <Form.Item name="organization" label="Организация" style={{maxHeight: '55px'}}>
                    <Select
                        showSearch
                        placeholder="Выберите организацию"
                        optionFilterProp="label"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={organizationsOptions}
                    />
                </Form.Item>

                <Form.Item name="warehouse" label="Склад" style={{maxHeight: '55px'}}>
                    <Select
                        showSearch
                        placeholder="Выберите склад"
                        optionFilterProp="label"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={warehousesOptions}
                    />
                </Form.Item>

                <Form.Item name="price_type" label="Тип цены" style={{maxHeight: '55px'}}>
                    <Select
                        showSearch
                        placeholder="Выберите тип цены"
                        optionFilterProp="label"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={priceTypesOptions}
                    />
                </Form.Item>

                <Form.Item name="paybox" label="Счет" style={{maxHeight: '55px'}}>
                    <Select
                        showSearch
                        placeholder="Выберите счёт"
                        optionFilterProp="label"
                        filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        options={payboxesOptions}
                    />
                </Form.Item>

                <Form.Item
                    name="priority"
                    label="Приоритет"
                    style={{
                        maxHeight: '55px'
                    }}
                >
                    <InputNumber min={0} max={10} style={{minWidth: '100%'}}/>
                </Form.Item>

                <Form.Item label="Товары" >
                    <Button onClick={() => setProductModal(true)} block>Выбрать товары</Button>
                    {selectedProducts.length > 0 && (<Table size="small" dataSource={selectedProducts || []} columns={productColumns} rowKey="id" pagination={false} />)}
                </Form.Item>

                <Button type="primary" block onClick={() => submit(form.getFieldsValue(), false, false)} loading={loading}>Создать продажу</Button>
                <Button type="default" block className="mt-2" onClick={() => submit(form.getFieldsValue(), false, false)} loading={loading}>Создать и провести</Button>
            </Form>

            <Modal open={productModal} onCancel={() => setProductModal(false)} footer={null} title="Выбор товаров">
                {loading ? <Spin /> : (
                    <>
                        <Input
                            placeholder="Поиск по названию"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ marginBottom: 16 }}
                        />
                        <Table
                            dataSource={(products || []).filter(p =>
                                p.name.toLowerCase().includes(search.toLowerCase())
                            )}
                            columns={[
                                { title: 'Название', dataIndex: 'name', key: 'name' },
                                { title: 'Действие', key: 'action', render: (_, record) => <Button onClick={() => addProduct(record)}>Добавить</Button> }
                            ]}
                            rowKey="id"
                            pagination={false}
                        />
                    </>
                )}
            </Modal>
        </div>
    );
}
