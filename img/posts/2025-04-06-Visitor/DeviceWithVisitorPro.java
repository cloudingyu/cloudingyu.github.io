public class DeviceWithVisitorPro {
    public static void main(String[] args) {
        Computer computer = new Computer(
                new Chassis(
                        new Harddisk(new Switch("harddisk")),
                        new Switch("chassis")),
                new Monitor(new Switch("monitor")));

        computer.getChassis().getSwitch1().close();
        computer.getMonitor().getSwitch1().close();

        computer.accept(new DeviceVisitorAdapter() {
            @Override
            public void visit(Switch sw) {
                sw.close();
            }
        });

    }
}

interface DeviceVisitor {
    void visit(Computer computer);

    void visit(Chassis chassis);

    void visit(Harddisk harddisk);

    void visit(Monitor monitor);

    void visit(Switch aSwitch);
}

class DeviceVisitorAdapter implements DeviceVisitor {

    @Override
    public void visit(Computer computer) {
    }

    @Override
    public void visit(Chassis chassis) {
    }

    @Override
    public void visit(Harddisk harddisk) {
    }

    @Override
    public void visit(Monitor monitor) {
    }

    @Override
    public void visit(Switch aSwitch) {
    }
}

interface DevicePart {
    void accept(DeviceVisitor visitor);
}

class Computer implements DevicePart {
    private Chassis chassis;
    private Monitor monitor;

    public Computer(Chassis chassis, Monitor monitor) {
        this.chassis = chassis;
        this.monitor = monitor;
    }

    public Chassis getChassis() {
        return chassis;
    }

    public Monitor getMonitor() {
        return monitor;
    }

    @Override
    public void accept(DeviceVisitor visitor) {
        chassis.accept(visitor);
        monitor.accept(visitor);
        visitor.visit(this);
    }
}

class Chassis implements DevicePart {

    private Harddisk harddisk;
    private Switch switch1;

    public Chassis(Harddisk harddisk, Switch switch1) {
        this.harddisk = harddisk;
        this.switch1 = switch1;
    }

    public Harddisk getHarddisk() {
        return harddisk;
    }

    public Switch getSwitch1() {
        return switch1;
    }

    @Override
    public void accept(DeviceVisitor visitor) {
        harddisk.accept(visitor);
        switch1.accept(visitor);
        visitor.visit(this);
    }

}

class Harddisk implements DevicePart {

    Switch sw;

    public Harddisk(Switch sw) {
        this.sw = sw;
    }

    @Override
    public void accept(DeviceVisitor visitor) {
        sw.accept(visitor);
        visitor.visit(this);
    }

    public Switch getSw() {
        return sw;
    }

}

class Monitor implements DevicePart {

    private Switch switch1;

    public Monitor(Switch sw) {
        this.switch1 = sw;
    }

    public Switch getSwitch1() {
        return switch1;
    }

    @Override
    public void accept(DeviceVisitor visitor) {
        switch1.accept(visitor);
        visitor.visit(this);
    }

}

class Switch implements DevicePart {
    private String name;

    public Switch(String name) {
        this.name = name;
    }

    public void close() {
        System.out.println(name + " switch closed");
    }

    @Override
    public void accept(DeviceVisitor visitor) {
        visitor.visit(this);
    }

}
